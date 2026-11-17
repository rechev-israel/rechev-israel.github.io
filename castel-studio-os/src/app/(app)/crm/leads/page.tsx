import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toLocalInput } from "@/lib/dates";
import { createLeadAction, updateLeadAction, convertLeadToCustomerAction } from "@/server/actions/leads";
import { convertLeadAction } from "@/server/actions/academy";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { AutoSubmitSelect } from "@/components/academy/auto-submit-select";
import { Badge, Card, CardTitle, Input, Label, PageHeader, Select, Stat, Textarea, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Leads" };
const COLS = ["NEW", "CONTACTED", "QUALIFIED", "ENROLLED", "LOST"] as const;

export default async function LeadsPipelinePage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("crm.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const { kind } = await searchParams;
  const k = kind === "barbershop" || kind === "academy" ? kind : undefined;
  const [leads, courses] = await Promise.all([
    db.lead.findMany({ where: { businessId: user.businessId, ...(k ? { kind: k } : {}) }, orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], include: { course: true }, take: 500 }),
    db.course.findMany({ where: { businessId: user.businessId, isActive: true } }),
  ]);
  const edit = can(user.role, "crm.edit");
  const now = new Date();
  const overdue = leads.filter((l) => l.nextFollowUpAt && l.nextFollowUpAt < now && !["ENROLLED", "LOST"].includes(l.status)).length;
  const open = leads.filter((l) => !["ENROLLED", "LOST"].includes(l.status)).length;
  const won = leads.filter((l) => l.status === "ENROLLED").length;
  return (
    <>
      <Link href="/crm" className="mb-2 inline-flex min-h-9 items-center text-xs text-muted hover:text-gold">← {t.crm.title}</Link>
      <PageHeader title={L("צינור לידים", "Lead pipeline")} subtitle={L("לידים למספרה ולאקדמיה — ממקור ועד סגירה", "Barbershop & academy leads — from source to close")} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={L("לידים פתוחים", "Open leads")} value={open} />
        <Stat label={L("מעקב באיחור", "Overdue follow-ups")} value={<span className={overdue ? "text-warning" : ""}>{overdue}</span>} />
        <Stat label={L("נסגרו בהצלחה", "Won")} value={won} />
        <Stat label={L("שיעור המרה", "Conversion")} value={leads.length ? `${Math.round((won / leads.length) * 100)}%` : "—"} />
      </div>
      <nav className="mb-4 flex gap-2">
        {[undefined, "barbershop", "academy"].map((x) => <Link key={x ?? "all"} href={x ? `/crm/leads?kind=${x}` : "/crm/leads"} className={buttonClass(k === x ? "outline" : "ghost", "sm")}>{x === "barbershop" ? L("מספרה", "Barbershop") : x === "academy" ? L("אקדמיה", "Academy") : t.common.all}</Link>)}
      </nav>
      <div className="grid gap-4 2xl:grid-cols-[320px_1fr]">
        {edit && (
          <Card className="h-fit">
            <CardTitle>{L("ליד חדש", "New lead")}</CardTitle>
            <ActionForm action={createLeadAction} resetOnSuccess className="space-y-2">
              <div><Label>{t.common.name} *</Label><Input name="name" required /><FieldError name="name" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t.common.phone}</Label><Input name="phone" type="tel" dir="ltr" /><FieldError name="phone" /></div>
                <div><Label>{L("סוג", "Type")}</Label><Select name="kind" defaultValue={k ?? "barbershop"}><option value="barbershop">{L("מספרה", "Barbershop")}</option><option value="academy">{L("אקדמיה", "Academy")}</option></Select></div>
              </div>
              <div><Label>{t.common.email}</Label><Input name="email" type="email" dir="ltr" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t.common.source}</Label><Input name="source" list="lead-sources" placeholder="instagram" /><datalist id="lead-sources">{["instagram", "tiktok", "whatsapp", "phone", "walk-in", "referral", "google"].map((s) => <option key={s} value={s} />)}</datalist></div>
                <div><Label>{L("מעקב בתאריך", "Follow up on")}</Label><Input name="nextFollowUpAt" type="date" defaultValue={toLocalInput(now, false)} /></div>
              </div>
              <div><Label>{L("קורס (לאקדמיה)", "Course (academy)")}</Label><Select name="courseId" defaultValue=""><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{locale === "he" ? c.nameHe : c.nameEn}</option>)}</Select></div>
              <div><Label>{t.common.notes}</Label><Textarea name="message" rows={2} /></div>
              <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="consent" className="h-4 w-4 accent-[var(--gold)]" /> {L("הליד הסכים שניצור איתו קשר", "Lead agreed to be contacted")}</label>
              <SubmitButton className="w-full">{t.common.add}</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {COLS.map((col) => {
            const list = leads.filter((l) => l.status === col);
            return (
              <div key={col} className="rounded-xl border border-border bg-surface/60 p-2">
                <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">{t.leadStatus[col]} <Badge>{list.length}</Badge></p>
                <div className="space-y-2">
                  {list.map((l) => {
                    const late = l.nextFollowUpAt && l.nextFollowUpAt < now && !["ENROLLED", "LOST"].includes(l.status);
                    return (
                      <Card key={l.id} className={`p-3 text-xs ${late ? "border-warning/50" : ""}`}>
                        <div className="flex items-start justify-between gap-1"><p className="text-sm font-medium">{l.name}</p><Badge tone={l.kind === "academy" ? "gold" : "info"}>{l.kind === "academy" ? L("אקדמיה", "Academy") : L("מספרה", "Shop")}</Badge></div>
                        <p className="text-muted" dir="ltr">{l.phone ?? l.email ?? "—"}</p>
                        {l.course && <p className="text-gold">{locale === "he" ? l.course.nameHe : l.course.nameEn}</p>}
                        {l.message && <p className="mt-1 line-clamp-2 text-muted">{l.message}</p>}
                        <p className="mt-1 text-[10px] text-muted">{formatDateTime(l.createdAt, locale)} · {l.source ?? ""}{!l.consent && <span className="text-warning"> · {L("ללא הסכמה לפנייה", "no contact consent")}</span>}</p>
                        {l.nextFollowUpAt && <p className={`text-[11px] ${late ? "text-warning" : "text-muted"}`}>{L("מעקב", "Follow-up")}: {formatDate(l.nextFollowUpAt, locale)}</p>}
                        {l.lostReason && <p className="text-[11px] text-danger">{l.lostReason}</p>}
                        {edit && (
                          <div className="mt-2 space-y-1">
                            <AutoSubmitSelect action={updateLeadAction} fields={{ id: l.id }} name="status" value={l.status} label={t.common.status} options={COLS.map((c) => ({ value: c, label: t.leadStatus[c] }))} />
                            <form action={updateLeadAction} className="flex gap-1">
                              <input type="hidden" name="id" value={l.id} />
                              <Input name="nextFollowUpAt" type="date" defaultValue={l.nextFollowUpAt ? toLocalInput(l.nextFollowUpAt, false) : ""} className="h-8 text-xs" aria-label={L("מעקב", "Follow-up")} />
                              <SubmitButton size="sm" variant="ghost">✓</SubmitButton>
                            </form>
                            {l.status === "LOST" && (
                              <form action={updateLeadAction} className="flex gap-1"><input type="hidden" name="id" value={l.id} /><Input name="lostReason" defaultValue={l.lostReason ?? ""} placeholder={L("סיבה", "Reason")} className="h-8 text-xs" /><SubmitButton size="sm" variant="ghost">✓</SubmitButton></form>
                            )}
                            {!["ENROLLED", "LOST"].includes(l.status) && (l.kind === "academy"
                              ? <InlineAction action={convertLeadAction} fields={{ id: l.id }} variant="outline" className="w-full">{t.academy.convert}</InlineAction>
                              : <InlineAction action={convertLeadToCustomerAction} fields={{ id: l.id }} variant="outline" className="w-full">{L("המרה ללקוח", "Convert to customer")}</InlineAction>)}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
