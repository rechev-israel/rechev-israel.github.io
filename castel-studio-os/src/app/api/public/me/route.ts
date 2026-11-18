import { rateLimit } from "@/lib/rate-limit";
import { customerOverview } from "@/server/services/customer-portal";
import { clientIp } from "../booking/errors";
import { preflight, withCors } from "../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** "My appointments" for the device that holds the customer's key (sent in the body, never in the URL). */
export async function POST(req: Request) {
  if (!rateLimit(`me:${clientIp(req)}`, 40, 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const body = (await req.json().catch(() => ({}))) as { d?: unknown };
  const o = await customerOverview(body.d);
  return withCors(req, o ? Response.json(o, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "unknown_device" }, { status: 404 }));
}
