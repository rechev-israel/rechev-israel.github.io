import { db } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { bookableDates, bookableStaff, getBookingSettings, publicBusiness } from "@/server/services/online-booking";
import { clientIp } from "../errors";
import { preflight, withCors } from "../cors";
import { after } from "next/server";
import { commsTick } from "@/server/comms/messages";
import { autoCompletePastAppointments } from "@/server/services/bookings";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Everything a website needs to render the booking form (public information only). */
export async function GET(req: Request) {
  if (!rateLimit(`bkcfg:${clientIp(req)}`, 60, 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const b = await publicBusiness();
  if (!b) return withCors(req, Response.json({ open: false, reason: "disabled" }));
  // Website visits also keep the business running (after the response, never slowing it down).
  after(async () => { await autoCompletePastAppointments(b.id).catch(() => 0); await commsTick(b.id).catch(() => null); });
  const s = await getBookingSettings(b.id);
  const branch = await db.branch.findFirst({ where: { businessId: b.id, isActive: true }, orderBy: { createdAt: "asc" }, select: { phone: true } });
  const base = { phone: branch?.phone ?? null, note: { he: s.noteHe ?? "", en: s.noteEn ?? "" }, cancelNoticeMin: s.cancelNoticeMin };
  if (!s.enabled) return withCors(req, Response.json({ open: false, reason: "disabled", ...base }));
  const [services, staff] = await Promise.all([
    db.service.findMany({ where: { businessId: b.id, isActive: true, bookableOnline: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }),
    bookableStaff(b.id),
  ]);
  const reason = !services.length ? "no_services" : !staff.length ? "no_staff" : "";
  return withCors(req, Response.json({
    open: !reason, reason, ...base,
    services: services.map((x) => ({ id: x.id, he: x.nameHe, en: x.nameEn, durationMin: x.durationMin, price: toNumber(x.price), premiumOnly: x.premiumOnly })),
    premiumSurcharge: s.premiumSurcharge,
    staff, dates: bookableDates(s.maxDaysAhead),
  }, { headers: { "Cache-Control": "no-store" } }));
}
