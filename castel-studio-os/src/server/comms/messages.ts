import { Prisma, type Channel, type MessageStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { canMarketTo } from "@/domain/crm";
import { DEFAULT_TEMPLATES, renderTemplate } from "./templates";
import { providerFor } from "./providers";

export type DraftInput = {
  businessId: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS";
  templateKey?: string;
  body?: string;
  subject?: string;
  purpose?: "transactional" | "marketing";
  customerId?: string | null;
  leadId?: string | null;
  studentId?: string | null;
  vars?: Record<string, string | number | null | undefined>;
  scheduledFor?: Date | null;
  automationRunId?: string | null;
  createdById?: string | null;
  locale?: string;
  /** From an automation: send without manual approval when the owner enabled auto-send for this purpose. */
  auto?: boolean;
};

/** Pure consent/contact decision — unit tested. */
export function contactDecision(input: {
  channel: string;
  purpose: string;
  customer?: { phone: string | null; email: string | null; status: string; marketingConsentSms: string; marketingConsentEmail: string; marketingConsentWhatsapp: string } | null;
  lead?: { phone: string | null; email: string | null; consent: boolean; status: string } | null;
  student?: { phone: string | null; email: string | null; status: string } | null;
}): { ok: true; to: string } | { ok: false; reason: string } {
  const { channel, purpose, customer, lead, student } = input;
  const to = channel === "EMAIL" ? customer?.email ?? lead?.email ?? student?.email : customer?.phone ?? lead?.phone ?? student?.phone;
  if (!to) return { ok: false, reason: "no_contact" };
  if (customer) {
    if (customer.status === "BLOCKED") return { ok: false, reason: "blocked" };
    const optedOut =
      (channel === "WHATSAPP" && customer.marketingConsentWhatsapp === "OPTED_OUT") ||
      (channel === "EMAIL" && customer.marketingConsentEmail === "OPTED_OUT") ||
      (channel === "SMS" && customer.marketingConsentSms === "OPTED_OUT");
    if (optedOut) return { ok: false, reason: "opted_out" };
    // Marketing requires explicit opt-in (Israeli Communications Law, Amendment 40).
    if (purpose === "marketing" && !canMarketTo(customer, channel as "SMS" | "EMAIL" | "WHATSAPP")) return { ok: false, reason: "no_marketing_consent" };
  }
  if (student && !customer && !lead) {
    // Enrolled students get service messages about their own course only; never marketing.
    if (student.status === "DROPPED") return { ok: false, reason: "student_dropped" };
    if (purpose === "marketing") return { ok: false, reason: "no_marketing_consent" };
  }
  if (lead && !customer) {
    if (!lead.consent) return { ok: false, reason: "no_consent" };
    if (lead.status === "LOST") return { ok: false, reason: "lead_lost" };
    if (purpose === "marketing") return { ok: false, reason: "no_marketing_consent" };
  }
  return { ok: true, to };
}

async function resolveTemplate(businessId: string, key: string, channel: string, locale: string) {
  const custom = await db.messageTemplate.findFirst({ where: { businessId, key, channel: channel as Channel, locale, isActive: true } });
  if (custom) return { subject: custom.subject, body: custom.body, purpose: custom.purpose as "transactional" | "marketing" };
  const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
  if (!def) return null;
  const l = locale === "en" ? "en" : "he";
  return { subject: def.subject?.[l] ?? null, body: def.body[l], purpose: def.purpose };
}

/** Create a message awaiting approval (or BLOCKED_NO_CONSENT). Never sends. */
export async function draftMessage(input: DraftInput) {
  const locale = input.locale ?? "he";
  const tpl = input.templateKey ? await resolveTemplate(input.businessId, input.templateKey, input.channel, locale) : null;
  const purpose = input.purpose ?? tpl?.purpose ?? "transactional";
  const customer = input.customerId ? await db.customer.findFirst({ where: { id: input.customerId, businessId: input.businessId } }) : null;
  const lead = input.leadId ? await db.lead.findFirst({ where: { id: input.leadId, businessId: input.businessId } }) : null;
  const student = input.studentId ? await db.student.findFirst({ where: { id: input.studentId, businessId: input.businessId } }) : null;
  const name = customer?.firstName ?? lead?.name?.split(/\s+/)[0] ?? student?.firstName ?? "";
  const vars = { business: "CASTEL STUDIO", name, ...input.vars };
  const body = renderTemplate(input.body ?? tpl?.body ?? "", vars);
  if (!body) throw new Error("empty message body");
  const decision = contactDecision({ channel: input.channel, purpose, customer, lead, student });
  let autoApprove = false;
  if (decision.ok && input.auto) {
    const s = await db.bookingSettings.findUnique({ where: { businessId: input.businessId }, select: { autoSendTransactional: true, autoSendMarketing: true } });
    // Marketing auto-send still requires explicit opt-in — contactDecision already refused anyone without it.
    autoApprove = purpose === "marketing" ? Boolean(s?.autoSendMarketing) : s ? s.autoSendTransactional : true;
  }
  const status: MessageStatus = !decision.ok ? "BLOCKED_NO_CONSENT" : autoApprove ? "APPROVED" : "PENDING_APPROVAL";
  const created = await db.outboundMessage.create({
    data: {
      businessId: input.businessId,
      channel: input.channel as Channel,
      purpose,
      customerId: customer?.id ?? null,
      leadId: lead?.id ?? null,
      studentId: student?.id ?? null,
      recipientName: customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : lead?.name ?? (student ? [student.firstName, student.lastName].filter(Boolean).join(" ") : null),
      toAddress: decision.ok ? decision.to : null,
      subject: input.subject ?? (tpl?.subject ? renderTemplate(tpl.subject, vars) : null),
      body,
      status,
      error: decision.ok ? null : decision.reason,
      templateKey: input.templateKey ?? null,
      scheduledFor: input.scheduledFor ?? null,
      automationRunId: input.automationRunId ?? null,
      createdById: input.createdById ?? null,
      templateVars: vars as Prisma.InputJsonValue,
      approvedAt: autoApprove ? new Date() : null,
    },
  });
  if (autoApprove && !created.scheduledFor) {
    await sendApprovedMessage(created.id).catch(() => null);
    return (await db.outboundMessage.findUnique({ where: { id: created.id } })) ?? created;
  }
  return created;
}

/**
 * Send one APPROVED message through its real provider. Returns the new status.
 * Unconfigured provider → stays APPROVED with an explanatory error (never marked as sent).
 */
export async function sendApprovedMessage(id: string) {
  const m = await db.outboundMessage.findUnique({ where: { id } });
  if (!m || m.status !== "APPROVED") return m?.status ?? null;
  if (m.scheduledFor && m.scheduledFor > new Date()) return m.status; // will be sent by the scheduler
  const provider = providerFor(m.channel);
  if (!provider || !provider.configured() || !m.toAddress) {
    await db.outboundMessage.update({ where: { id }, data: { error: provider ? "provider_not_configured" : "channel_not_supported" } });
    return "APPROVED" as const;
  }
  await db.outboundMessage.update({ where: { id }, data: { status: "SENDING", attempts: { increment: 1 } } });
  const r = await provider.send({ to: m.toAddress, subject: m.subject, body: m.body, templateKey: m.templateKey, vars: (m.templateVars ?? {}) as Record<string, unknown> });
  if (r.ok) {
    await db.outboundMessage.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), provider: provider.id, providerMessageId: r.providerMessageId, error: null } });
    if (m.customerId) {
      await db.interaction.create({ data: { customerId: m.customerId, channel: m.channel, direction: "OUTBOUND", summary: m.body.slice(0, 500) } });
    }
    return "SENT" as const;
  }
  const giveUp = !r.retryable || m.attempts + 1 >= 3;
  await db.outboundMessage.update({ where: { id }, data: { status: giveUp ? "FAILED" : "APPROVED", provider: provider.id, error: r.error.slice(0, 500) } });
  return giveUp ? ("FAILED" as const) : ("APPROVED" as const);
}

/** Owner approval (bulk). Approved messages are sent immediately when a provider is configured and they are due. */
export async function approveMessages(actor: { id: string; businessId: string }, ids: string[]) {
  const r = await db.outboundMessage.updateMany({
    where: { id: { in: ids }, businessId: actor.businessId, status: { in: ["PENDING_APPROVAL", "DRAFT"] } },
    data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() },
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "message.approve", entityType: "OutboundMessage", metadata: { count: r.count } });
  const results: Record<string, number> = {};
  for (const id of ids) {
    const s = await sendApprovedMessage(id);
    if (s) results[s] = (results[s] ?? 0) + 1;
  }
  return { approved: r.count, results };
}

export async function cancelMessages(actor: { id: string; businessId: string }, ids: string[]) {
  const r = await db.outboundMessage.updateMany({
    where: { id: { in: ids }, businessId: actor.businessId, status: { in: ["PENDING_APPROVAL", "DRAFT", "APPROVED", "BLOCKED_NO_CONSENT"] } },
    data: { status: "CANCELLED" },
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "message.cancel", entityType: "OutboundMessage", metadata: { count: r.count } });
  return r.count;
}

/** Called by the scheduler: send approved messages whose scheduled time has arrived. */
export async function flushDueMessages(limit = 50) {
  const due = await db.outboundMessage.findMany({
    where: { status: "APPROVED", OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const m of due) if ((await sendApprovedMessage(m.id)) === "SENT") sent++;
  return { checked: due.length, sent };
}

const lastFlush = new Map<string, number>();
const ensured = new Set<string>();
/** Throttled housekeeping run while the app/website is in use: built-in automations exist, due messages go out. */
export async function commsTick(businessId: string) {
  if (Date.now() - (lastFlush.get(businessId) ?? 0) < 60_000) return;
  lastFlush.set(businessId, Date.now());
  if (!ensured.has(businessId)) {
    const { ensureBuiltinAutomations } = await import("@/server/automation/defaults");
    await ensureBuiltinAutomations(db, businessId).catch(() => 0);
    ensured.add(businessId);
  }
  await flushDueMessages(20).catch(() => null);
}
