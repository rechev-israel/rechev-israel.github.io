import { db } from "@/lib/db";
import { getSessionUser } from "@/server/auth/session";
import { notificationWhere } from "@/server/notify/visibility";

export const dynamic = "force-dynamic";

/** Marks a notification read and opens what it points to (e.g. the appointment in the calendar). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = new URL(req.url).origin;
  const user = await getSessionUser();
  if (!user) return Response.redirect(`${origin}/login`, 303);
  const n = await db.notification.findFirst({ where: notificationWhere(user, { id }) });
  if (!n) return Response.redirect(`${origin}/notifications`, 303);
  if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  const target = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications";
  return Response.redirect(`${origin}${target}`, 303);
}
