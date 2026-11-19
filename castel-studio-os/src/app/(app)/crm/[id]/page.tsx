import { ExperienceCard } from "@/components/crm/experience-card";
import { ContactButtons } from "@/components/contact-buttons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowRight, CalendarPlus, ListPlus, Pin, Trash2 } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatILS, fullName } from "@/lib/utils";
import { updateCustomerAction, addNoteAction, deleteNoteAction, logInteractionAction, archiveCustomerAction, createFollowUpTaskAction, setCustomerBlockedAction } from "@/server/actions/crm";
import { ActionForm as BlockForm, SubmitButton as BlockSubmit } from "@/components/forms";
import { ActionForm, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Label, PageHeader, Select, Stat, Table, Td, Textarea, Th, buttonClass } from "@/components/ui";
import { CustomerFields, segmentTone } from "@/components/crm/customer-fields";
import { Forbidden } from "@/components/forbidden";
import { loyaltyTier, nextMilestone } from "@/domain/loyalty";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("crm.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { id } = await params;
  const c = await db.customer.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      notes: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { author: { select: { name: true } } } },
      appointments: { orderBy: { startsAt: "desc" }, take: 50, include: { service: true, staff: { select: { name: true } } } },
      interactions: { orderBy: { occurredAt: "desc" }, take: 50 },
      outboundMessages: { orderBy: { createdAt: "desc" }, take: 50 },
      transactions: { orderBy: { occurredAt: "desc" }, take: 50 },
    },
  });
  if (!c) notFound();
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const tier = loyaltyTier(c.visitCount, Number(c.totalSpent));
  const next = nextMilestone(c.visitCount);
  const tierLabel = { NEW: L("חדש", "New"), SILVER: L("כסף", "Silver"), GOLD: L("זהב", "Gold"), PLATINUM: L("פלטינום", "Platinum") }[tier];
  type Ev = { at: Date; kind: string; title: string; detail?: string; tone: "gold" | "success" | "danger" | "neutral" | "info" | "warning" };
  const timeline: Ev[] = [
    ...c.appointments.map((a): Ev => ({ at: a.startsAt, kind: L("תור", "Appointment"), title: `${a.service ? (locale === "he" ? a.service.nameHe : a.service.nameEn) : "—"} · ${t.apptStatus[a.status]}`, detail: a.source === "cali" ? "Cali" : undefined, tone: a.status === "COMPLETED" ? "success" : a.status === "NO_SHOW" ? "danger" : a.status === "CANCELLED" ? "neutral" : "info" })),
    ...c.interactions.map((i): Ev => ({ at: i.occurredAt, kind: t.channels[i.channel], title: i.summary.slice(0, 140), detail: t.directions[i.direction], tone: "neutral" })),
    ...c.outboundMessages.map((m): Ev => ({ at: m.sentAt ?? m.createdAt, kind: L("הודעה", "Message"), title: m.body.slice(0, 140), detail: m.status, tone: m.status === "SENT" ? "success" : m.status === "FAILED" || m.status === "BLOCKED_NO_CONSENT" ? "warning" : "gold" })),
    ...c.transactions.map((x): Ev => ({ at: x.occurredAt, kind: x.type === "INCOME" ? L("תשלום", "Payment") : L("הוצאה", "Expense"), title: formatILS(x.amount, locale), detail: x.kind === "ESTIMATE" ? L("הערכה", "Estimate") : undefined, tone: "gold" })),
    ...c.notes.map((n): Ev => ({ at: n.createdAt, kind: L("הערה", "Note"), title: n.body.slice(0, 140), detail: n.author?.name, tone: "neutral" })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60);
  const edit = can(user.role, "crm.edit");
  const noShows = c.appointments.filter((a) => a.status === "NO_SHOW").length;
  const cancels = c.appointments.filter((a) => a.status === "CANCELLED").length;
  const statusTone = { COMPLETED: "success", CANCELLED: "neutral", NO_SHOW: "danger", SCHEDULED: "info", CONFIRMED: "gold" } as const;

  return (
    <>
      <Link href="/crm" className="mb-2 inline-flex min-h-9 items-center gap-1 text-xs text-muted hover:text-gold"><ArrowRight size={12} className="ltr:rotate-180" /> {t.crm.title}</Link>
      <PageHeader
        title={fullName(c)}
        subtitle={[c.phone, c.email].filter(Boolean).map((v) => `\u2066${v}\u2069`).join(" · ") || undefined}
        actions={
          <>
            <ContactButtons phone={c.phone} he={locale === "he"} />
            <Badge tone={segmentTone(c.status)} className="h-8 px-3 text-xs">{t.segments[c.status]}</Badge>
            {can(user.role, "bookings.edit") && <Link href={`/bookings/new?customerId=${c.id}`} className={buttonClass("secondary")}><CalendarPlus size={14} /> {t.bookings.new}</Link>}
            {can(user.role, "tasks.edit") && <InlineAction action={createFollowUpTaskAction} fields={{ customerId: c.id }} variant="secondary" size="md"><ListPlus size={14} /> {t.crm.followUp}</InlineAction>}
            {can(user.role, "crm.delete") && <InlineAction action={archiveCustomerAction} fields={{ id: c.id }} variant="danger" size="md" confirm={t.common.archive + "?"}><Archive size={14} /> {t.common.archive}</InlineAction>}
          </>
        }
      />
      {c.archivedAt && <Badge tone="warning" className="mb-4">{t.crm.archived}</Badge>}
      <ExperienceCard businessId={user.businessId} customerId={c.id} locale={locale} canEdit={can(user.role, "crm.edit")} isOwner={can(user.role, "services.edit")} />
      {can(user.role, "crm.delete") && (c.status === "BLOCKED" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4">
          <div className="text-sm"><b className="text-danger">🚫 {locale === "he" ? "הלקוח חסום" : "Customer blocked"}</b><p className="mt-0.5 text-xs text-muted">{locale === "he" ? "לא יכול לקבוע תור באתר, לא מקבל הודעות, ו״התורים שלי״ סגור בפניו. אפשר עדיין לקבוע לו תור ידנית מהמערכת." : "Can't book online, gets no messages, and \"My appointments\" is closed. You can still book him manually."}</p></div>
          <BlockForm action={setCustomerBlockedAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="block" value="0" /><BlockSubmit variant="secondary" size="sm">{locale === "he" ? "ביטול חסימה" : "Unblock"}</BlockSubmit></BlockForm>
        </div>
      ) : (
        <details className="mb-4 rounded-2xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold text-danger">🚫 {locale === "he" ? "חסימת לקוח" : "Block customer"}</summary>
          <BlockForm action={setCustomerBlockedAction} className="mt-3 space-y-2">
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="block" value="1" />
            <p className="text-xs text-muted">{locale === "he" ? "לקוח חסום לא יוכל לקבוע תור באתר (הוא יראה ״לא ניתן לקבוע תור אונליין, צרו קשר עם המספרה״ — בלי לדעת שנחסם), לא יקבל הודעות, ו״התורים שלי״ ייסגר בפניו." : "A blocked customer can't book online (sees a neutral message), gets no messages, and \"My appointments\" closes."}</p>
            <input name="reason" maxLength={300} placeholder={locale === "he" ? "סיבה (לא חובה, רק בשבילך)" : "Reason (optional, private)"} className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm" />
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="cancelFuture" className="h-4 w-4 accent-[var(--gold)]" /> {locale === "he" ? "לבטל גם את התורים העתידיים שלו" : "Also cancel his upcoming appointments"}</label>
            <BlockSubmit variant="danger" size="sm">{locale === "he" ? "חסימה" : "Block"}</BlockSubmit>
          </BlockForm>
        </details>
      ))}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={L("דרגת נאמנות", "Loyalty tier")} value={<span className="gold-text">{tierLabel}</span>} hint={next ? L(`עוד ${next.remaining} ביקורים לאבן דרך ${next.at}`, `${next.remaining} visits to milestone ${next.at}`) : undefined} />
        <Stat label={t.crm.visits} value={c.visitCount} />
        <Stat label={t.crm.spent} value={formatILS(c.totalSpent, locale)} />
        <Stat label={t.crm.lastVisit} value={<span className="text-lg">{formatDate(c.lastVisitAt, locale)}</span>} />
        <Stat label={`${t.apptStatus.NO_SHOW} / ${t.apptStatus.CANCELLED}`} value={`${noShows} / ${cancels}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardTitle>{L("ציר זמן מאוחד", "Unified timeline")}</CardTitle>
            {timeline.length ? (
              <ol className="relative space-y-3 border-s border-border ps-4">
                {timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-gold/60 bg-bg" />
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]"><Badge tone={e.tone}>{e.kind}</Badge><span className="tabular-nums text-muted">{formatDateTime(e.at, locale)}</span>{e.detail && <span className="text-muted">· {e.detail}</span>}</div>
                    <p className="mt-0.5 text-sm">{e.title}</p>
                  </li>
                ))}
              </ol>
            ) : <EmptyState title={t.common.empty} />}
          </Card>
          <Card>
            <CardTitle>{t.crm.history}</CardTitle>
            {c.appointments.length ? (
              <Table>
                <thead><tr><Th>{t.common.date}</Th><Th>{t.bookings.service}</Th><Th>{t.bookings.staff}</Th><Th>{t.common.status}</Th><Th className="text-end">{t.common.price}</Th></tr></thead>
                <tbody>
                  {c.appointments.map((a) => (
                    <tr key={a.id}>
                      <Td className="tabular-nums text-muted">{formatDateTime(a.startsAt, locale)}</Td>
                      <Td>{a.service ? (locale === "he" ? a.service.nameHe : a.service.nameEn) : "—"}</Td>
                      <Td className="text-muted">{a.staff?.name ?? "—"}</Td>
                      <Td><Badge tone={statusTone[a.status]}>{t.apptStatus[a.status]}</Badge></Td>
                      <Td className="text-end tabular-nums">{a.price ? formatILS(a.price, locale) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title={t.common.empty} />}
          </Card>

          <Card>
            <CardTitle>{t.crm.interactions}</CardTitle>
            {edit && (
              <ActionForm action={logInteractionAction.bind(null, c.id)} resetOnSuccess showSuccess={false} className="mb-4 grid gap-3 sm:grid-cols-[140px_140px_1fr_auto] sm:items-end">
                <div><Label>{t.crm.channel}</Label><Select name="channel">{(["PHONE", "WHATSAPP", "SMS", "EMAIL", "INSTAGRAM", "IN_PERSON", "OTHER"] as const).map((ch) => <option key={ch} value={ch}>{t.channels[ch]}</option>)}</Select></div>
                <div><Label>{t.crm.direction}</Label><Select name="direction"><option value="INBOUND">{t.directions.INBOUND}</option><option value="OUTBOUND">{t.directions.OUTBOUND}</option></Select></div>
                <div><Label>{t.crm.summary}</Label><Textarea name="summary" required className="min-h-10" rows={1} /></div>
                <SubmitButton variant="secondary">{t.crm.logInteraction}</SubmitButton>
              </ActionForm>
            )}
            {c.interactions.length ? (
              <ul className="space-y-2">
                {c.interactions.map((i) => (
                  <li key={i.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                      <Badge>{t.channels[i.channel]}</Badge><Badge tone={i.direction === "INBOUND" ? "info" : "gold"}>{t.directions[i.direction]}</Badge>
                      <span className="tabular-nums">{formatDateTime(i.occurredAt, locale)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{i.summary}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title={t.common.empty} />}
          </Card>

          {edit && (
            <Card>
              <CardTitle>{t.crm.profile}</CardTitle>
              <ActionForm action={updateCustomerAction.bind(null, c.id)}>
                <CustomerFields t={t} c={c} />
                <div className="mt-6 flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>
              </ActionForm>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>{t.crm.preferences}</CardTitle>
            <p className="whitespace-pre-wrap text-sm text-muted">{c.preferences || "—"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div><p className="text-muted">WhatsApp</p><Badge tone={c.marketingConsentWhatsapp === "OPTED_IN" ? "success" : c.marketingConsentWhatsapp === "OPTED_OUT" ? "danger" : "neutral"}>{t.consent[c.marketingConsentWhatsapp]}</Badge></div>
              <div><p className="text-muted">SMS</p><Badge tone={c.marketingConsentSms === "OPTED_IN" ? "success" : c.marketingConsentSms === "OPTED_OUT" ? "danger" : "neutral"}>{t.consent[c.marketingConsentSms]}</Badge></div>
              <div><p className="text-muted">{t.common.email}</p><Badge tone={c.marketingConsentEmail === "OPTED_IN" ? "success" : c.marketingConsentEmail === "OPTED_OUT" ? "danger" : "neutral"}>{t.consent[c.marketingConsentEmail]}</Badge></div>
            </div>
            {c.birthday && <p className="mt-3 text-xs text-muted">{t.crm.birthday}: {formatDate(c.birthday, locale, { timeZone: "UTC" })}</p>}
          </Card>

          <Card>
            <CardTitle>{t.crm.notesTitle}</CardTitle>
            {edit && (
              <ActionForm action={addNoteAction.bind(null, c.id)} resetOnSuccess showSuccess={false} className="mb-4 space-y-2">
                <Textarea name="body" required placeholder={t.crm.addNote} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="pinned" className="accent-[var(--gold)]" /> {t.crm.pin}</label>
                  <SubmitButton size="sm">{t.crm.addNote}</SubmitButton>
                </div>
              </ActionForm>
            )}
            {c.notes.length ? (
              <ul className="space-y-2">
                {c.notes.map((n) => (
                  <li key={n.id} className={`rounded-lg border px-3 py-2 text-sm ${n.pinned ? "border-gold/40 bg-gold-soft" : "border-border bg-surface-2"}`}>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                      <span className="flex items-center gap-1">{n.pinned && <Pin size={11} className="text-gold" />}{n.author?.name ?? "—"} · {formatDateTime(n.createdAt, locale)}</span>
                      {edit && <InlineAction action={deleteNoteAction} fields={{ id: n.id }} confirm={t.common.delete + "?"}><Trash2 size={12} /></InlineAction>}
                    </div>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title={t.common.empty} />}
          </Card>
        </div>
      </div>
    </>
  );
}
