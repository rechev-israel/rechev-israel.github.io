import { rateLimit } from "@/lib/rate-limit";
import { cancelByToken } from "@/server/services/online-booking";
import { bookingErrorResponse, clientIp } from "../errors";

export async function POST(req: Request) {
  if (!rateLimit(`bookcancel:${clientIp(req)}`, 10, 10 * 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { token?: unknown };
  if (typeof body.token !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    await cancelByToken(body.token);
    return Response.json({ ok: true });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}
