import { rateLimit } from "@/lib/rate-limit";
import { getSlots, publicBusiness } from "@/server/services/online-booking";
import { zonedParts } from "@/lib/dates";
import { bookingErrorResponse, clientIp } from "../errors";
import { preflight, withCors } from "../cors";

export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export async function GET(req: Request) {
  return withCors(req, await handle(req));
}

async function handle(req: Request) {
  if (!rateLimit(`slots:${clientIp(req)}`, 90, 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  const u = new URL(req.url);
  const serviceId = u.searchParams.get("serviceId") ?? "";
  const staffId = u.searchParams.get("staffId") ?? "any";
  const date = u.searchParams.get("date") ?? "";
  if (!/^[a-z0-9]{8,40}$/i.test(serviceId) || !/^(any|[a-z0-9]{8,40})$/i.test(staffId)) return Response.json({ error: "bad_request" }, { status: 400 });
  const b = await publicBusiness();
  if (!b) return Response.json({ error: "disabled" }, { status: 503 });
  try {
    const { slots, surcharge } = await getSlots(b.id, { serviceId, staffId, date });
    return Response.json({ slots: slots.map((s) => { const p = zonedParts(new Date(s.start)); return { start: s.start, label: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`, premium: s.premium, surcharge: s.premium ? surcharge : 0 }; }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}
