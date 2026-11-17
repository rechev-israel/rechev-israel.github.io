import { icsEvent } from "@/domain/booking";
import { findByToken } from "@/server/services/online-booking";

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const a = await findByToken(t);
  if (!a || a.status === "CANCELLED") return new Response("not found", { status: 404 });
  const body = icsEvent({ uid: a.id, start: a.startsAt, end: a.endsAt, title: `${a.service?.nameHe ?? "תור"} — ${a.business.name}`, location: a.business.city, description: a.staff ? `ספר: ${a.staff.name}` : undefined });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="castel-booking.ics"', "Cache-Control": "no-store" } });
}
