import { rateLimit } from "@/lib/rate-limit";
import { availableDays, publicBusiness } from "@/server/services/online-booking";
import { bookingErrorResponse, clientIp } from "../errors";
import { preflight, withCors } from "../cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Free-slot count per bookable day, for the customer date calendar. */
export async function GET(req: Request) {
  return withCors(req, await handle(req));
}

async function handle(req: Request) {
  if (!rateLimit(`bkdays:${clientIp(req)}`, 60, 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  const u = new URL(req.url);
  const serviceId = u.searchParams.get("serviceId") ?? "";
  const staffId = u.searchParams.get("staffId") ?? "any";
  if (!/^[a-z0-9]{8,40}$/i.test(serviceId) || !/^(any|[a-z0-9]{8,40})$/i.test(staffId)) return Response.json({ error: "bad_request" }, { status: 400 });
  const b = await publicBusiness();
  if (!b) return Response.json({ error: "disabled" }, { status: 503 });
  try {
    return Response.json({ days: await availableDays(b.id, { serviceId, staffId }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}
