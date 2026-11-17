import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { addMonths, startOfMonth, toLocalInput, zonedDate, zonedParts } from "@/lib/dates";
import { formatDate, formatILS, toNumber } from "@/lib/utils";
import { aiConfigured } from "@/server/ai/provider";
import { approveCampaignAction, campaignStatusAction, deleteContentAction, generateMarketingAction, saveCampaignAction, saveCampaignResultsAction, saveContentAction, saveContentMetricsAction } from "@/server/actions/marketing";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Stat, Table, Td, Textarea, Th, buttonClass } from "@/components/ui";
import { CategoryBars } from "@/components/charts";
import { Generator } from "@/components/marketing/generator";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";
const TABS = ["overview", "campaigns", "calendar", "ai"] as const;

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string; month?: string }> }) {
  const { user, locale, t, allowed } = await pageGuard("marketing.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";
  const edit = can(user.role, "marketing.edit");
  const monthStart = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? startOfMonth(new Date(sp.month + "-15T12:00:00Z")) : startOfMonth();
  const monthEnd = addMonths(monthStart, 1);
  const since90 = new Date(Date.now() - 90 * 86400_000);

  const [campaigns, content, leads, customersBySource] = await Promise.all([
    db.campaign.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { contentItems: true } } } }),
    db.contentItem.findMany({ where: { businessId: user.businessId, ...(tab === "calendar" ? { OR: [{ scheduledFor: { gte: monthStart, lt: monthEnd } }, { scheduledFor: null }] } : {}) }, orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }], take: 300 }),
    db.lead.findMany({ where: { businessId: user.businessId, createdAt: { gte: since90 } }, select: { status: true, source: true, kind: true } }),
    db.customer.groupBy({ by: ["source"], where: { businessId: user.businessId, createdAt: { gte: since90 } }, _count: true }),
  ]);
  const funnel = [
    { k: L("לידים (90 יום)", "Leads (90d)"), v: leads.length },
    { k: L("נוצר קשר", "Contacted"), v: leads.filter((l) => ["CONTACTED", "QUALIFIED", "ENROLLED"].includes(l.status)).length },
    { k: L("מתאימים", "Qualified"), v: leads.filter((l) => ["QUALIFIED", "ENROLLED"].includes(l.status)).length },
    { k: L("נרשמו", "Enrolled"), v: leads.filter((l) => l.status === "ENROLLED").length },
  ];
  const statusTone = { draft: "neutral", pending_approval: "gold", approved: "info", live: "success", ended: "neutral", idea: "neutral", published: "success" } as const;
  const statusLabel: Record<string, string> = { draft: L("טיוטה", "Draft"), pending_approval: L("ממתין לאישור", "Pending approval"), approved: L("מאושר", "Approved"), live: L("פעיל", "Live"), ended: L("הסתיים", "Ended"), idea: L("רעיון", "Idea"), published: L("פורסם (ידני)", "Published (manual)") };
  const totalSpend = campaigns.reduce((s, c) => s + toNumber(c.spendActual), 0);
  const totalCampaignLeads = campaigns.reduce((s, c) => s + (c.leads ?? 0), 0);

  // calendar grid (Sunday-first)
  const p = zonedParts(monthStart);
  const firstWeekday = p.weekday;
  const daysInMonth = zonedParts(new Date(monthEnd.getTime() - 3600_000)).day;
  const mKey = toLocalInput(monthStart, false).slice(0, 7);
  const tabLabel = { overview: L("סקירה ומשפך", "Overview & funnel"), campaigns: L("קמפיינים", "Campaigns"), calendar: L("לוח תוכן", "Content calendar"), ai: L("מחוללי AI", "AI generators") };

  return (
    <>
      <PageHeader title={t.nav.marketing} subtitle={L("קמפיינים, לוח תוכן לאינסטגרם וטיקטוק, משפך לידים ומחוללי תוכן AI", "Campaigns, Instagram & TikTok content calendar, lead funnel and AI content generators")} />
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((k) => <Link key={k} href={`/marketing?tab=${k}`} className={buttonClass(tab === k ? "outline" : "ghost", "sm", "shrink-0")}>{tabLabel[k]}</Link>)}
      </nav>

      {tab === "overview" && (
        <>
          <Notice tone="neutral" className="mb-4">{L("Meta Ads, Instagram, TikTok ו-Google Ads עדיין לא מחוברים, ולכן אין משיכת נתונים אוטומטית. תוצאות קמפיינים ותוכן מוזנות ידנית ומסומנות ככאלה.", "Meta Ads, Instagram, TikTok and Google Ads are not connected yet, so nothing is pulled automatically. Campaign and content results are entered manually and labelled as such.")} <Link href="/integrations" className="text-gold underline">{t.nav.integrations}</Link></Notice>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={L("קמפיינים פעילים", "Live campaigns")} value={campaigns.filter((c) => c.status === "live").length} hint={`${campaigns.length} ${L("סה״כ", "total")}`} />
            <Stat label={L("הוצאה בפועל (ידני)", "Actual spend (manual)")} value={formatILS(totalSpend, locale)} />
            <Stat label={L("לידים מקמפיינים (ידני)", "Campaign leads (manual)")} value={totalCampaignLeads} hint={totalCampaignLeads && totalSpend ? `${L("עלות לליד", "Cost/lead")}: ${formatILS(totalSpend / totalCampaignLeads, locale)}` : undefined} />
            <Stat label={L("פריטי תוכן מתוכננים", "Planned content items")} value={content.filter((c) => c.status !== "published").length} hint={`${L("פורסמו", "Published")}: ${content.filter((c) => c.status === "published").length}`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>{L("משפך לידים (90 יום, נתוני אמת)", "Lead funnel (90d, real data)")}</CardTitle>
              <div className="space-y-2">
                {funnel.map((f, i) => (
                  <div key={f.k}>
                    <div className="mb-1 flex justify-between text-xs"><span>{f.k}</span><span className="tabular-nums">{f.v}{i > 0 && funnel[0].v ? ` · ${Math.round((f.v / funnel[0].v) * 100)}%` : ""}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-gold" style={{ width: `${funnel[0].v ? Math.max(2, (f.v / funnel[0].v) * 100) : 0}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardTitle>{L("מקורות לקוחות חדשים (90 יום)", "New customer sources (90d)")}</CardTitle>
              {customersBySource.length ? <CategoryBars data={customersBySource.map((s) => ({ label: s.source ?? "—", amount: s._count }))} locale={locale === "he" ? "raw" : "en"} /> : <EmptyState title={t.common.empty} />}
            </Card>
          </div>
        </>
      )}

      {tab === "campaigns" && (
        <div className="grid gap-4 xl:grid-cols-3">
          {edit && (
            <Card>
              <CardTitle>{L("קמפיין חדש", "New campaign")}</CardTitle>
              <ActionForm action={saveCampaignAction.bind(null, null)} resetOnSuccess className="space-y-3">
                <div><Label>{t.common.name} *</Label><Input name="name" required /><FieldError name="name" /></div>
                <div><Label>{L("ערוץ", "Channel")}</Label><Select name="channel">{["instagram", "tiktok", "meta-ads", "google-ads", "whatsapp", "email", "offline", "other"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
                <div><Label>{L("מטרה", "Objective")}</Label><Input name="objective" /></div>
                <div><Label>{L("קהל יעד", "Audience")}</Label><Textarea name="audience" rows={2} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>{L("תקציב ₪", "Budget ₪")}</Label><Input name="budget" type="number" min={0} /></div>
                  <div><Label>{L("התחלה", "Start")}</Label><Input name="startsAt" type="date" /></div>
                  <div><Label>{L("סיום", "End")}</Label><Input name="endsAt" type="date" /></div>
                </div>
                <SubmitButton className="w-full">{t.common.create}</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <div className={`space-y-3 ${edit ? "xl:col-span-2" : "xl:col-span-3"}`}>
            {campaigns.length === 0 ? <EmptyState title={t.common.empty} /> : campaigns.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap gap-1.5"><Badge tone={statusTone[c.status as keyof typeof statusTone] ?? "neutral"}>{statusLabel[c.status] ?? c.status}</Badge><Badge>{c.channel}</Badge></div>
                    <h3 className="mt-2 font-semibold">{c.name}</h3>
                    <p className="text-xs text-muted">{c.objective ?? ""} {c.startsAt && `· ${formatDate(c.startsAt, locale)}`}{c.endsAt && ` – ${formatDate(c.endsAt, locale)}`}{c.budget ? ` · ${L("תקציב", "budget")} ${formatILS(c.budget, locale)}` : ""}</p>
                  </div>
                  {edit && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.status === "draft" && <InlineAction action={campaignStatusAction} fields={{ id: c.id, status: "pending_approval" }} variant="outline">{L("הגשה לאישור", "Submit for approval")}</InlineAction>}
                      {c.status === "pending_approval" && can(user.role, "approvals.decide") && <InlineAction action={approveCampaignAction} fields={{ id: c.id }} variant="primary">{L("אישור", "Approve")}</InlineAction>}
                      {c.status === "approved" && <InlineAction action={campaignStatusAction} fields={{ id: c.id, status: "live" }} variant="primary">{L("סימון כפעיל", "Mark live")}</InlineAction>}
                      {c.status === "live" && <InlineAction action={campaignStatusAction} fields={{ id: c.id, status: "ended" }}>{L("סיום", "End")}</InlineAction>}
                    </div>
                  )}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gold">{L("תוצאות (הזנה ידנית)", "Results (manual entry)")}: {c.spendActual ? formatILS(c.spendActual, locale) : "—"} · {c.leads ?? "—"} {L("לידים", "leads")} · {c.clicks ?? "—"} {L("קליקים", "clicks")}</summary>
                  {edit && (
                    <ActionForm action={saveCampaignResultsAction.bind(null, c.id)} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6 sm:items-end">
                      <div><Label>{L("הוצאה ₪", "Spend ₪")}</Label><Input name="spendActual" type="number" min={0} defaultValue={c.spendActual ? toNumber(c.spendActual) : ""} /></div>
                      <div><Label>{L("חשיפות", "Impr.")}</Label><Input name="impressions" type="number" min={0} defaultValue={c.impressions ?? ""} /></div>
                      <div><Label>{L("קליקים", "Clicks")}</Label><Input name="clicks" type="number" min={0} defaultValue={c.clicks ?? ""} /></div>
                      <div><Label>{L("לידים", "Leads")}</Label><Input name="leads" type="number" min={0} defaultValue={c.leads ?? ""} /></div>
                      <div><Label>{L("המרות", "Conv.")}</Label><Input name="conversions" type="number" min={0} defaultValue={c.conversions ?? ""} /></div>
                      <SubmitButton size="sm" variant="secondary">{t.common.save}</SubmitButton>
                    </ActionForm>
                  )}
                </details>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <Link href={`/marketing?tab=calendar&month=${toLocalInput(addMonths(monthStart, -1), false).slice(0, 7)}`} className={buttonClass("ghost", "sm")}>‹</Link>
            <p className="font-display text-lg tabular-nums">{mKey}</p>
            <Link href={`/marketing?tab=calendar&month=${toLocalInput(addMonths(monthStart, 1), false).slice(0, 7)}`} className={buttonClass("ghost", "sm")}>›</Link>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <Card className="p-3">
              <div className="hidden grid-cols-7 gap-1 text-center text-[11px] text-muted md:grid">{t.days.map((d) => <div key={d}>{d}</div>)}</div>
              <div className="grid gap-1 md:grid-cols-7">
                {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} className="hidden md:block" />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const date = zonedDate(p.year, p.month, day, 12);
                  const key = toLocalInput(date, false);
                  const items = content.filter((c) => c.scheduledFor && toLocalInput(c.scheduledFor, false) === key);
                  if (!items.length) return <div key={day} className="hidden min-h-20 rounded-lg border border-border/60 p-1.5 text-[11px] text-muted md:block">{day}</div>;
                  return (
                    <div key={day} className="min-h-20 rounded-lg border border-gold/30 bg-gold-soft/40 p-1.5">
                      <p className="text-[11px] font-semibold">{day} <span className="font-normal text-muted md:hidden">· {t.days[zonedParts(date).weekday]}</span></p>
                      {items.map((it) => (
                        <p key={it.id} className="mt-1 truncate rounded bg-surface px-1.5 py-1 text-[11px]" title={it.title}>
                          <span className={it.platform === "tiktok" ? "text-info" : "text-gold"}>{it.platform === "tiktok" ? "TT" : it.platform === "instagram" ? "IG" : it.platform.slice(0, 2).toUpperCase()}</span> {it.title}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
            {edit && (
              <Card>
                <CardTitle>{L("פריט תוכן חדש", "New content item")}</CardTitle>
                <ActionForm action={saveContentAction.bind(null, null)} resetOnSuccess className="space-y-2">
                  <div><Label>{L("כותרת / רעיון", "Title / idea")} *</Label><Input name="title" required /><FieldError name="title" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>{L("פלטפורמה", "Platform")}</Label><Select name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook</option><option value="other">{t.channels.OTHER}</option></Select></div>
                    <div><Label>{L("פורמט", "Format")}</Label><Select name="format"><option value="reel">Reel</option><option value="post">Post</option><option value="story">Story</option><option value="carousel">Carousel</option><option value="video">Video</option></Select></div>
                  </div>
                  <div><Label>{L("כיתוב", "Caption")}</Label><Textarea name="caption" rows={3} /></div>
                  <div><Label>{L("האשטאגים", "Hashtags")}</Label><Input name="hashtags" placeholder="#barber #ashkelon" dir="ltr" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>{t.common.date}</Label><Input name="scheduledFor" type="date" defaultValue={`${mKey}-01`} /></div>
                    <div><Label>{t.common.status}</Label><Select name="status" defaultValue="idea">{["idea", "draft", "pending_approval", "approved"].map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</Select></div>
                  </div>
                  <div><Label>{L("קמפיין", "Campaign")}</Label><Select name="campaignId" defaultValue=""><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                  <SubmitButton className="w-full">{t.common.add}</SubmitButton>
                </ActionForm>
              </Card>
            )}
          </div>
          <Card className="mt-4">
            <CardTitle>{L("פריטי תוכן", "Content items")}</CardTitle>
            {content.length === 0 ? <EmptyState title={t.common.empty} /> : (
              <Table>
                <thead><tr><Th>{t.common.date}</Th><Th>{L("פריט", "Item")}</Th><Th>{t.common.status}</Th><Th>{L("ביצועים (ידני)", "Performance (manual)")}</Th><Th /></tr></thead>
                <tbody>
                  {content.map((it) => (
                    <tr key={it.id}>
                      <Td className="whitespace-nowrap text-xs text-muted">{it.scheduledFor ? formatDate(it.scheduledFor, locale) : "—"}</Td>
                      <Td className="min-w-56"><p className="font-medium">{it.title}</p><p className="text-[11px] text-muted">{it.platform} · {it.format}</p>{it.caption && <p className="mt-1 line-clamp-2 text-xs text-muted">{it.caption}</p>}{it.hashtags.length > 0 && <p className="mt-1 truncate text-[11px] text-gold" dir="ltr">{it.hashtags.join(" ")}</p>}</Td>
                      <Td>
                        {edit ? (
                          <ActionForm action={saveContentAction.bind(null, it.id)} showSuccess={false} className="flex gap-1">
                            {(["title", "platform", "format", "caption"] as const).map((k) => <input key={k} type="hidden" name={k} value={String(it[k] ?? "")} />)}
                            <input type="hidden" name="hashtags" value={it.hashtags.join(" ")} />
                            <input type="hidden" name="scheduledFor" value={it.scheduledFor ? toLocalInput(it.scheduledFor, false) : ""} />
                            <input type="hidden" name="campaignId" value={it.campaignId ?? ""} />
                            <Select name="status" defaultValue={it.status} className="h-8 w-36 text-xs">{["idea", "draft", "pending_approval", "approved", "published"].map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</Select>
                            <SubmitButton size="sm" variant="ghost">✓</SubmitButton>
                          </ActionForm>
                        ) : <Badge>{statusLabel[it.status]}</Badge>}
                      </Td>
                      <Td className="min-w-48 text-xs">
                        <details><summary className="cursor-pointer text-muted">{it.views ?? "—"} {L("צפיות", "views")} · {it.likes ?? "—"} ♥ · {it.leads ?? "—"} {L("לידים", "leads")}</summary>
                          {edit && (
                            <ActionForm action={saveContentMetricsAction.bind(null, it.id)} className="mt-2 grid grid-cols-3 gap-1">
                              {(["views", "likes", "comments", "saves", "leads"] as const).map((k) => <Input key={k} name={k} type="number" min={0} placeholder={k} defaultValue={it[k] ?? ""} className="h-8 text-xs" aria-label={k} />)}
                              <SubmitButton size="sm" variant="secondary">{t.common.save}</SubmitButton>
                            </ActionForm>
                          )}
                        </details>
                      </Td>
                      <Td>{edit && <InlineAction action={deleteContentAction} fields={{ id: it.id }} confirm={t.common.delete + "?"}>✕</InlineAction>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      {tab === "ai" && (
        <Card>
          <CardTitle>{tabLabel.ai}</CardTitle>
          <p className="mb-4 text-xs text-muted">{L("התוצאות נוצרות בזמן אמת על ידי מודל ה-AI המוגדר, על בסיס נתוני העסק המצטברים. שום דבר לא מתפרסם אוטומטית — העתיקו את הטקסט או בקשו מסוכן הקריאייטיב לשמור אותו בלוח התוכן.", "Results are generated live by the configured AI model using aggregated business data. Nothing is published automatically — copy the text or ask the Creative agent to save it to the content calendar.")}</p>
          {edit ? (
            <Generator action={generateMarketingAction} configured={aiConfigured()} labels={{
              kind: L("סוג", "Type"), caption: L("כיתובים", "Captions"), hashtags: L("האשטאגים", "Hashtags"), ad: L("קופי למודעה", "Ad copy"), calendar: L("לוח תוכן חודשי", "Monthly calendar"), strategy: L("אסטרטגיית קמפיין", "Campaign strategy"),
              platform: L("פלטפורמה", "Platform"), topic: L("נושא", "Topic"), placeholder: L("לדוגמה: מחזור חדש לקורס הקבוצתי בינואר", "e.g. new group course cohort in January"),
              generate: L("יצירה", "Generate"), copy: L("העתקה", "Copy"), aiLabel: L("נוצר על ידי AI — לבדיקה לפני שימוש", "AI-generated — review before use"),
              notConfigured: t.ai.notConfigured,
            }} />
          ) : <Notice tone="neutral">{t.errors.forbidden}</Notice>}
        </Card>
      )}
    </>
  );
}
