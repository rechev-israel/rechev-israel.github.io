import { db } from "@/lib/db";
import { requireApiUser } from "@/server/auth/session";
import { notificationWhere } from "@/server/notify/visibility";

export const dynamic = "force-dynamic";

/** Polled by the header bell for live unread count + newest item. */
export async function GET(req: Request) {
  const r = await requireApiUser(req);
  if ("error" in r) return r.error;
  const where = notificationWhere(r.user);
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { ...where, readAt: null } }),
    db.notification.findFirst({ where: { ...where, readAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, body: true, createdAt: true, kind: true } }),
  ]);
  return Response.json({ unread, latest }, { headers: { "Cache-Control": "no-store" } });
}
