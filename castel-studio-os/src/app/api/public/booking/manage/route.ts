import { rateLimit } from "@/lib/rate-limit";
import { toNumber } from "@/lib/utils";
import { zonedParts } from "@/lib/dates";
import { canCustomerCancel } from "@/domain/booking";
import { findByToken, getBookingSettings } from "@/server/services/online-booking";
import { reviewForAppointment } from "@/server/services/reviews";
import { db } from "@/lib/db";
import { bookingRef, googleCalendarUrl, liveState } from "@/domain/experience";
import { clientIp } from "../errors";
import { preflight, withCors } from "../cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Booking details for the holder of the private link (token). */
export async function GET(req: Request) {
  if (!rateLimit(`bkman:${clientIp(req)}`, 30, 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const a = await findByToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!a) return withCors(req, Response.json({ error: "not_found" }, { status: 404 }));
  const [s, review] = await Promise.all([getBookingSettings(a.businessId), reviewForAppointment(a.id)]);
  const p = zonedParts(a.startsAt);
  const active = a.status === "SCHEDULED" || a.status === "CONFIRMED";
  return withCors(req, Response.json({
    status: a.status, firstName: a.customer?.firstName ?? "", name: [a.customer?.firstName, a.customer?.lastName].filter(Boolean).join(" "), durationMin: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000),
    service: a.service ? { he: a.service.nameHe, en: a.service.nameEn } : null, price: toNumber(a.price),
    startsAt: a.startsAt.getTime(), date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
    staff: a.staff?.name ?? null, past: a.startsAt.getTime() < Date.now(),
    canCancel: active && canCustomerCancel(a.startsAt.getTime(), Date.now(), s.cancelNoticeMin), cancelNoticeMin: s.cancelNoticeMin, review,
    // MY CASTEL extras: real status (incl. the shop's live updates), reference, calendar link, special request
    live: liveState(a), delayMin: a.liveStatus === "delay" ? a.liveDelayMin : null, ref: bookingRef(a.id), endsAt: a.endsAt.getTime(),
    google: googleCalendarUrl({ title: `${a.service?.nameHe ?? "תור"} — CASTEL STUDIO`, start: a.startsAt, end: a.endsAt, location: a.business.city }),
    hasRequest: Boolean(await db.appointmentRequest.findUnique({ where: { appointmentId: a.id }, select: { id: true } })),
  }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }));
}
