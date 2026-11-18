import { rateLimit } from "@/lib/rate-limit";
import { toNumber } from "@/lib/utils";
import { zonedParts } from "@/lib/dates";
import { canCustomerCancel } from "@/domain/booking";
import { findByToken, getBookingSettings } from "@/server/services/online-booking";
import { clientIp } from "../errors";
import { preflight, withCors } from "../cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Booking details for the holder of the private link (token). */
export async function GET(req: Request) {
  if (!rateLimit(`bkman:${clientIp(req)}`, 30, 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const a = await findByToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!a) return withCors(req, Response.json({ error: "not_found" }, { status: 404 }));
  const s = await getBookingSettings(a.businessId);
  const p = zonedParts(a.startsAt);
  const active = a.status === "SCHEDULED" || a.status === "CONFIRMED";
  return withCors(req, Response.json({
    status: a.status, firstName: a.customer?.firstName ?? "",
    service: a.service ? { he: a.service.nameHe, en: a.service.nameEn } : null, price: toNumber(a.price),
    startsAt: a.startsAt.getTime(), date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
    staff: a.staff?.name ?? null, past: a.startsAt.getTime() < Date.now(),
    canCancel: active && canCustomerCancel(a.startsAt.getTime(), Date.now(), s.cancelNoticeMin), cancelNoticeMin: s.cancelNoticeMin,
  }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }));
}
