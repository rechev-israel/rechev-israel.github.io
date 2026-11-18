import { rateLimit } from "@/lib/rate-limit";
import { claimDeviceByManageToken } from "@/server/services/customer-portal";
import { clientIp } from "../../booking/errors";
import { preflight, withCors } from "../../booking/cors";

export const OPTIONS = preflight;

/** Link this device to the customer who owns a booking's private manage link. */
export async function POST(req: Request) {
  if (!rateLimit(`meclaim:${clientIp(req)}`, 10, 10 * 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const body = (await req.json().catch(() => ({}))) as { t?: unknown; d?: string };
  const deviceToken = await claimDeviceByManageToken(body.t, body.d);
  return withCors(req, deviceToken ? Response.json({ deviceToken }) : Response.json({ error: "not_found" }, { status: 404 }));
}
