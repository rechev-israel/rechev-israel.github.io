"use server";
import { notificationWhere } from "@/server/notify/visibility";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { approveMessages, cancelMessages, draftMessage } from "@/server/comms/messages";
import { getI18n } from "@/i18n";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

function ids(fd: FormData) {
  return fd.getAll("ids").map(String).filter(Boolean).slice(0, 200);
}

export async function approveMessagesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("comms.approve");
    const { locale } = await getI18n();
    const list = ids(fd);
    if (!list.length) return { error: locale === "he" ? "לא נבחרו הודעות" : "No messages selected" };
    const r = await approveMessages(user, list);
    revalidatePath("/communications");
    const sent = r.results.SENT ?? 0;
    const waiting = r.results.APPROVED ?? 0;
    return {
      ok: true,
      message: locale === "he"
        ? `אושרו ${r.approved}. נשלחו בפועל: ${sent}. ממתינות לספק/מועד שליחה: ${waiting}. נכשלו: ${r.results.FAILED ?? 0}.`
        : `Approved ${r.approved}. Actually sent: ${sent}. Waiting for provider/schedule: ${waiting}. Failed: ${r.results.FAILED ?? 0}.`,
    };
  });
}

export async function cancelMessagesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("comms.draft");
    const n = await cancelMessages(user, ids(fd));
    revalidatePath("/communications");
    return { ok: true, message: `✓ ${n}` };
  });
}

export async function composeMessageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("comms.draft");
    const input = z
      .object({
        customerId: z.string().min(1),
        channel: z.enum(["WHATSAPP", "EMAIL"]),
        purpose: z.enum(["transactional", "marketing"]),
        templateKey: z.string().max(60).optional(),
        body: z.string().max(2000).optional(),
      })
      .parse({ customerId: fd.get("customerId"), channel: fd.get("channel"), purpose: fd.get("purpose"), templateKey: fd.get("templateKey") || undefined, body: fd.get("body") || undefined });
    if (!input.templateKey && !input.body?.trim()) return { error: "—", fieldErrors: { body: "required" } };
    const { locale } = await getI18n();
    const m = await draftMessage({ businessId: user.businessId, ...input, body: input.body?.trim() || undefined, createdById: user.id, locale });
    await audit({ businessId: user.businessId, userId: user.id, action: "message.draft", entityType: "OutboundMessage", entityId: m.id, metadata: { status: m.status } });
    revalidatePath("/communications");
    const reason = m.error === "no_marketing_consent" ? (locale === "he" ? "אין ללקוח הסכמה לדיוור שיווקי בערוץ זה" : "customer has no marketing consent on this channel")
      : m.error === "no_contact" ? (locale === "he" ? "אין ללקוח פרטי קשר בערוץ זה" : "customer has no contact details for this channel")
      : m.error === "opted_out" ? (locale === "he" ? "הלקוח הסיר עצמו מהערוץ" : "customer opted out of this channel") : m.error;
    return m.status === "BLOCKED_NO_CONSENT"
      ? { error: (locale === "he" ? "ההודעה נחסמה: " : "Message blocked: ") + reason }
      : { ok: true, message: locale === "he" ? "✓ ההודעה נוספה לתור האישורים" : "✓ Added to the approval queue" };
  });
}

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("comms.approve");
    const input = z
      .object({
        key: z.string().regex(/^[a-z0-9_]{2,40}$/),
        channel: z.enum(["WHATSAPP", "EMAIL"]),
        locale: z.enum(["he", "en"]),
        purpose: z.enum(["transactional", "marketing"]),
        name: z.string().trim().min(1).max(100),
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(Object.fromEntries(fd.entries()));
    await db.messageTemplate.upsert({
      where: { businessId_key_channel_locale: { businessId: user.businessId, key: input.key, channel: input.channel, locale: input.locale } },
      create: { businessId: user.businessId, ...input, subject: input.subject || null },
      update: { name: input.name, purpose: input.purpose, subject: input.subject || null, body: input.body, isActive: true },
    });
    await audit({ businessId: user.businessId, userId: user.id, action: "template.save", entityType: "MessageTemplate", metadata: { key: input.key, channel: input.channel } });
    revalidatePath("/communications");
  });
}

export async function markNotificationsReadAction(fd: FormData) {
  const user = await requireUser();
  const id = fd.get("id") ? String(fd.get("id")) : null;
  await db.notification.updateMany({
    where: { ...notificationWhere(user), readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/** Single form, two buttons (op=approve | op=cancel) sharing the same checkbox selection. */
export async function bulkMessagesAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  return fd.get("op") === "cancel" ? cancelMessagesAction(prev, fd) : approveMessagesAction(prev, fd);
}

export async function saveAutoSendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("comms.approve"); // owner
    const data = { autoSendTransactional: fd.get("autoSendTransactional") === "on", autoSendMarketing: fd.get("autoSendMarketing") === "on" };
    await db.bookingSettings.upsert({ where: { businessId: user.businessId }, create: { businessId: user.businessId, ...data }, update: data });
    const { ensureBuiltinAutomations } = await import("@/server/automation/defaults");
    await ensureBuiltinAutomations(db, user.businessId);
    await audit({ businessId: user.businessId, userId: user.id, action: "comms.autosend", entityType: "BookingSettings", metadata: data });
    revalidatePath("/communications");
  });
}
