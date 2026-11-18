import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { zonedParts } from "@/lib/dates";
import { sendPush } from "./push";

export type OwnerEvent = "booking_created" | "booking_pending" | "booking_cancelled" | "booking_rescheduled";

const TITLE: Record<OwnerEvent, string> = {
  booking_created: "תור חדש נקבע",
  booking_pending: "תור חדש ממתין לאישור",
  booking_cancelled: "תור בוטל",
  booking_rescheduled: "תור הוזז",
};
const STATUS_HE: Record<string, string> = { CONFIRMED: "מאושר", SCHEDULED: "ממתין לאישור", CANCELLED: "בוטל", COMPLETED: "הושלם", NO_SHOW: "לא הגיע" };
const pad = (n: number) => String(n).padStart(2, "0");

export function appointmentLink(a: { id: string; startsAt: Date }) {
  const p = zonedParts(a.startsAt);
  return `/bookings?view=day&date=${p.year}-${pad(p.month)}-${pad(p.day)}&appt=${a.id}`;
}

/** Hebrew body used in the notification center and phone push. */
export function appointmentSummary(a: { startsAt: Date; endsAt: Date; status: string; customerName: string; serviceName: string; previousStartsAt?: Date | null }) {
  const p = zonedParts(a.startsAt);
  const date = a.startsAt.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const lines = [
    `לקוח: ${a.customerName || "—"}`,
    `שירות: ${a.serviceName || "—"}`,
    `תאריך: ${date}`,
    `שעה: ${pad(p.hour)}:${pad(p.minute)}`,
    `משך: ${Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000)} דקות`,
    `סטטוס: ${STATUS_HE[a.status] ?? a.status}`,
  ];
  if (a.previousStartsAt) {
    const q = zonedParts(a.previousStartsAt);
    lines.push(`מועד קודם: ${pad(q.day)}.${pad(q.month)} ${pad(q.hour)}:${pad(q.minute)}`);
  }
  return lines.join("\n");
}

/**
 * Create ONE internal notification for owners/managers about an appointment event (deduplicated by key) and push it to
 * their subscribed devices. Never throws: notification problems must not break a booking.
 */
export async function notifyAppointmentEvent(event: OwnerEvent, appointmentId: string, opts: { dedupeSuffix?: string; previousStartsAt?: Date | null; actorUserId?: string | null } = {}) {
  try {
    const a = await db.appointment.findUnique({ where: { id: appointmentId }, include: { customer: true, service: true } });
    if (!a) return null;
    const customerName = [a.customer?.firstName, a.customer?.lastName].filter(Boolean).join(" ");
    const body = appointmentSummary({ ...a, customerName, serviceName: a.service?.nameHe ?? "", previousStartsAt: opts.previousStartsAt });
    const title = `${TITLE[event]}: ${customerName || "לקוח"}`;
    const link = appointmentLink(a);
    const dedupeKey = `appt:${a.id}:${event}${opts.dedupeSuffix ? `:${opts.dedupeSuffix}` : ""}`;
    let created;
    try {
      created = await db.notification.create({ data: { businessId: a.businessId, kind: event, level: event === "booking_cancelled" ? "warn" : event === "booking_pending" ? "warn" : "info", title, body, link, entityId: a.id, dedupeKey } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null; // already notified for this event
      throw e;
    }
    const owners = await db.user.findMany({ where: { businessId: a.businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { id: true } });
    const p = zonedParts(a.startsAt);
    // The person who made the change already knows about it: no push to their own devices.
    await sendPush(a.businessId, owners.map((o) => o.id).filter((id) => id !== opts.actorUserId), {
      title,
      body: `${a.service?.nameHe ?? ""} · ${pad(p.day)}.${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`,
      url: link,
      tag: `appt-${a.id}`,
    });
    return created;
  } catch (e) {
    logger.error("notify.appointment_failed", { err: String(e), appointmentId, event });
    return null;
  }
}
