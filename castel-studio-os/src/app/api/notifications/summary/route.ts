import { db } from "@/lib/db";
import { requireApiUser } from "@/server/auth/session";
import { notificationWhere } from "@/server/notify/visibility";
import { autoCompletePastAppointments } from "@/server/services/bookings";
import { commsTick } from "@/server/comms/messages";

export const dynamic = "force-dynamic";

/** Polled by the header bell for live unread count + newest item. */
export async function GET(req: Request) {
  const r = await requireApiUser(req);
  if ("error" in r) return r.error;
  // While the app is open, past appointments complete themselves (throttled to once a minute).
  const completed = await autoCompletePastAppointments(r.user.businessId).catch(() => 0);
  await commsTick(r.user.businessId).catch(() => null);
  const where = notificationWhere(r.user);
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { ...where, readAt: null } }),
    db.notification.findFirst({ where: { ...where, readAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, body: true, createdAt: true, kind: true } }),
  ]);
  return Response.json({ unread, latest, completed }, { headers: { "Cache-Control": "no-store" } });
}
