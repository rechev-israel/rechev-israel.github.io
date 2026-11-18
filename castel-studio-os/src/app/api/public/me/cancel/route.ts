import { rateLimit } from "@/lib/rate-limit";
import { cancelFromPortal } from "@/server/services/customer-portal";
import { clientIp } from "../../booking/errors";
import { preflight, withCors } from "../../booking/cors";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  if (!rateLimit(`mecancel:${clientIp(req)}`, 10, 10 * 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const body = (await req.json().catch(() => ({}))) as { d?: unknown; id?: unknown };
  const r = await cancelFromPortal(body.d, body.id);
  return withCors(req, Response.json(r, { status: r.ok ? 200 : r.error === "too_late" ? 409 : 404 }));
}
