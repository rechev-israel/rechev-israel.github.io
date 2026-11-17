import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import type { MessageStatus } from "@prisma/client";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime, fullName } from "@/lib/utils";
import { PROVIDERS } from "@/server/comms/providers";
import { DEFAULT_TEMPLATES } from "@/server/comms/templates";
import { bulkMessagesAction, composeMessageAction, saveTemplateAction } from "@/server/actions/comms";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Stat, Textarea, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Communications" };
export const dynamic = "force-dynamic";

const TABS = ["queue", "outbox", "blocked", "compose", "templates"] as const;
const statusTone: Record<MessageStatus, "gold" | "success" | "danger" | "neutral" | "info" | "warning"> = {
  DRAFT: "neutral", PENDING_APPROVAL: "gold", APPROVED: "info", SENDING: "info", SENT: "success", DELIVERED: "success", FAILED: "danger", CANCELLED: "neutral", BLOCKED_NO_CONSENT: "warning",
};

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, locale, t, allowed } = await pageGuard("comms.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const tab = (TABS as readonly string[]).includes((await searchParams).tab ?? "") ? ((await searchParams).tab as (typeof TABS)[number]) : "queue";
  const statusLabel: Record<MessageStatus, string> = {
    DRAFT: L("טיוטה", "Draft"), PENDING_APPROVAL: L("ממתין לאישור", "Awaiting approval"), APPROVED: L("אושר — ממתין לשליחה", "Approved — waiting to send"),
    SENDING: L("בשליחה", "Sending"), SENT: L("נשלח", "Sent"), DELIVERED: L("נמסר", "Delivered"), FAILED: L("נכשל", "Failed"), CANCELLED: L("בוטל", "Cancelled"), BLOCKED_NO_CONSENT: L("נחסם — אין הסכמה/פרטי קשר", "Blocked — no consent/contact"),
  };
  const errLabel = (e: string | null) => !e ? "" : e === "provider_not_configured" ? L("ספק לא מוגדר", "Provider not configured") : e === "no_marketing_consent" ? L("אין הסכמה לדיוור שיווקי", "No marketing consent") : e === "no_contact" ? L("אין פרטי קשר בערוץ זה", "No contact for this channel") : e === "opted_out" ? L("הלקוח הסיר עצמו", "Customer opted out") : e;

  const where = { businessId: user.businessId };
  const [counts, list, customers, templates] = await Promise.all([
    db.outboundMessage.groupBy({ by: ["status"], where, _count: true }),
    tab === "compose" || tab === "templates" ? Promise.resolve([]) : db.outboundMessage.findMany({
      where: { ...where, status: { in: tab === "queue" ? ["PENDING_APPROVAL", "DRAFT"] : tab === "blocked" ? ["BLOCKED_NO_CONSENT", "CANCELLED"] : ["APPROVED", "SENDING", "SENT", "DELIVERED", "FAILED"] } },
      orderBy: { createdAt: "desc" }, take: 150,
    }),
    tab === "compose" ? db.customer.findMany({ where: { ...where, archivedAt: null }, orderBy: { firstName: "asc" }, take: 1000, select: { id: true, firstName: true, lastName: true, phone: true } }) : Promise.resolve([]),
    tab === "templates" ? db.messageTemplate.findMany({ where }) : Promise.resolve([]),
  ]);
  const c = (s: MessageStatus) => counts.find((x) => x.status === s)?._count ?? 0;
  const canApprove = can(user.role, "comms.approve");
  const tabLabel = { queue: `${L("לאישור", "To approve")} (${c("PENDING_APPROVAL")})`, outbox: L("יוצא ומצב משלוח", "Outbox & delivery"), blocked: L("נחסמו / בוטלו", "Blocked / cancelled"), compose: L("הודעה חדשה", "New message"), templates: L("תבניות", "Templates") };

  return (
    <>
      <PageHeader title={t.nav.communications} subtitle={L("כל הודעה ללקוח עוברת כאן: טיוטה → אישור שלך → שליחה דרך ספק אמיתי → מעקב מסירה", "Every customer message passes here: draft → your approval → real provider → delivery tracking")} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={L("ממתינות לאישור", "Awaiting approval")} value={c("PENDING_APPROVAL")} />
        <Stat label={L("אושרו, ממתינות לספק/מועד", "Approved, waiting")} value={c("APPROVED")} />
        <Stat label={L("נשלחו", "Sent")} value={c("SENT") + c("DELIVERED")} hint={`${L("נכשלו", "Failed")}: ${c("FAILED")}`} />
        <Stat label={L("נחסמו (הסכמה/פרטים)", "Blocked (consent/contact)")} value={c("BLOCKED_NO_CONSENT")} />
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {[{ p: PROVIDERS.WHATSAPP, icon: MessageCircle, name: "WhatsApp Cloud API", env: "WHATSAPP_CLOUD_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID" }, { p: PROVIDERS.EMAIL, icon: Mail, name: "Email (SMTP)", env: "SMTP_URL + SMTP_FROM" }].map(({ p, icon: Icon, name, env }) => (
          <Card key={p.id} className="flex items-start gap-3 p-4">
            <Icon size={20} className={p.configured() ? "text-success" : "text-muted"} />
            <div className="min-w-0 text-sm">
              <p className="font-medium">{name} <Badge tone={p.configured() ? "success" : "neutral"}>{p.configured() ? t.integrations.CONNECTED : t.integrations.NOT_CONFIGURED}</Badge></p>
              <p className="mt-1 text-[11px] text-muted">{p.configured() ? L("הודעות מאושרות נשלחות דרך הספק.", "Approved messages are sent through this provider.") : L("הודעות מאושרות נשארות בתור ולא נשלחות עד שהספק יוגדר: ", "Approved messages stay queued until configured: ")}{!p.configured() && <code dir="ltr" className="text-gold">{env}</code>}</p>
            </div>
          </Card>
        ))}
      </div>

      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((k) => <Link key={k} href={`/communications?tab=${k}`} className={buttonClass(tab === k ? "outline" : "ghost", "sm", "shrink-0")}>{tabLabel[k]}</Link>)}
      </nav>

      {(tab === "queue" || tab === "outbox" || tab === "blocked") && (
        <Card className="p-4">
          {/* Form stays mounted when the list empties, so the approval result message remains visible. */}
            <ActionForm action={bulkMessagesAction}>
              {list.length === 0 && <EmptyState title={t.common.empty} />}
              {tab === "queue" && list.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {canApprove && <button name="op" value="approve" className={buttonClass("primary", "sm")}>{L("אישור ושליחת המסומנות", "Approve & send selected")}</button>}
                  <button name="op" value="cancel" className={buttonClass("secondary", "sm")}>{L("ביטול המסומנות", "Cancel selected")}</button>
                  {!canApprove && <span className="text-xs text-muted">{L("רק הבעלים יכול לאשר שליחה.", "Only the owner can approve sending.")}</span>}
                </div>
              )}
              <ul className="space-y-2">
                {list.map((m) => (
                  <li key={m.id} className="rounded-xl border border-border bg-surface-2 p-3">
                    <label className="flex gap-3">
                      {tab === "queue" && <input type="checkbox" name="ids" value={m.id} defaultChecked className="mt-1 h-5 w-5 shrink-0 accent-[var(--gold)]" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
                          <Badge>{m.channel === "WHATSAPP" ? "WhatsApp" : m.channel === "EMAIL" ? "Email" : m.channel}</Badge>
                          <Badge tone={m.purpose === "marketing" ? "warning" : "neutral"}>{m.purpose === "marketing" ? L("שיווקי", "Marketing") : L("שירותי", "Service")}</Badge>
                          {m.automationRunId && <Badge tone="info">{L("אוטומציה", "Automation")}</Badge>}
                          <span className="text-muted">{formatDateTime(m.createdAt, locale)}</span>
                          {m.scheduledFor && <span className="text-muted">· {L("לשליחה", "send at")} {formatDateTime(m.scheduledFor, locale)}</span>}
                        </div>
                        <p className="mt-1 text-sm font-medium">{m.recipientName ?? "—"} {m.toAddress && <span className="text-xs font-normal text-muted" dir="ltr">{m.toAddress}</span>}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.body}</p>
                        {(m.error || m.sentAt) && <p className="mt-1 text-[11px]">{m.sentAt && <span className="text-success">✓ {formatDateTime(m.sentAt, locale)} · {m.provider}</span>} {m.error && <span className="text-warning">{errLabel(m.error)}</span>}</p>}
                        {m.customerId && <Link href={`/crm/${m.customerId}`} className="mt-1 inline-block text-[11px] text-gold underline">{t.crm.profile}</Link>}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </ActionForm>
        </Card>
      )}

      {tab === "compose" && (
        <Card className="max-w-2xl">
          <CardTitle>{tabLabel.compose}</CardTitle>
          <Notice tone="gold" className="mb-4">{L("ההודעה תיכנס לתור האישורים. הודעה שיווקית תיחסם אוטומטית אם ללקוח אין הסכמה לדיוור בערוץ שנבחר.", "The message enters the approval queue. Marketing messages are automatically blocked if the customer has not opted in on that channel.")}</Notice>
          <ActionForm action={composeMessageAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>{t.bookings.customer} *</Label><Select name="customerId" required>{customers.map((x) => <option key={x.id} value={x.id}>{fullName(x)}{x.phone ? ` · ${x.phone}` : ""}</option>)}</Select></div>
            <div><Label>{t.crm.channel}</Label><Select name="channel"><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option></Select></div>
            <div><Label>{L("סוג", "Type")}</Label><Select name="purpose"><option value="transactional">{L("שירותי (תור/שירות)", "Service (appointment/service)")}</option><option value="marketing">{L("שיווקי (מבצע/פרסום)", "Marketing (promo/ad)")}</option></Select></div>
            <div className="sm:col-span-2"><Label>{L("תבנית (אופציונלי)", "Template (optional)")}</Label><Select name="templateKey" defaultValue=""><option value="">{L("— טקסט חופשי —", "— Free text —")}</option>{DEFAULT_TEMPLATES.map((tp) => <option key={tp.key} value={tp.key}>{locale === "he" ? tp.name.he : tp.name.en}</option>)}</Select></div>
            <div className="sm:col-span-2"><Label>{L("טקסט ההודעה (אם לא נבחרה תבנית)", "Message text (if no template)")}</Label><Textarea name="body" rows={4} /><FieldError name="body" /></div>
            <div className="sm:col-span-2 flex justify-end"><SubmitButton>{L("הוספה לתור האישורים", "Add to approval queue")}</SubmitButton></div>
          </ActionForm>
        </Card>
      )}

      {tab === "templates" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {DEFAULT_TEMPLATES.flatMap((tp) => (["WHATSAPP", "EMAIL"] as const).map((ch) => {
            const custom = templates.find((x) => x.key === tp.key && x.channel === ch && x.locale === locale);
            const l = locale === "en" ? "en" : "he";
            return (
              <Card key={`${tp.key}-${ch}`} className="p-4">
                <CardTitle action={<Badge tone={custom ? "gold" : "neutral"}>{custom ? L("מותאם", "Customised") : L("ברירת מחדל", "Default")}</Badge>}>{tp.name[l]} · {ch === "WHATSAPP" ? "WhatsApp" : "Email"}</CardTitle>
                <ActionForm action={saveTemplateAction} className="space-y-2">
                  <input type="hidden" name="key" value={tp.key} /><input type="hidden" name="channel" value={ch} /><input type="hidden" name="locale" value={l} /><input type="hidden" name="purpose" value={tp.purpose} /><input type="hidden" name="name" value={tp.name[l]} />
                  {ch === "EMAIL" && <Input name="subject" defaultValue={custom?.subject ?? tp.subject?.[l] ?? ""} aria-label="subject" />}
                  <Textarea name="body" rows={4} defaultValue={custom?.body ?? tp.body[l]} disabled={!canApprove} />
                  <p className="text-[11px] text-muted" dir="ltr">{"{{name}} {{date}} {{time}} {{service}} {{course}}"}</p>
                  {canApprove && <div className="flex justify-end"><SubmitButton size="sm" variant="secondary">{t.common.save}</SubmitButton></div>}
                </ActionForm>
              </Card>
            );
          }))}
        </div>
      )}
    </>
  );
}
