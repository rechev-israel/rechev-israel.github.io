import { rateLimit } from "@/lib/rate-limit";
import { customerOverviewByPhone } from "@/server/services/customer-portal";
import { clientIp } from "../booking/errors";
import { preflight, withCors } from "../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** "My appointments" by phone number (owner's decision). Rate limited per IP. */
export async function POST(req: Request) {
  if (!rateLimit(`me:${clientIp(req)}`, 20, 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const o = await customerOverviewByPhone(body.phone);
  return withCors(req, o ? Response.json(o, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "not_found" }, { status: 404 }));
}
