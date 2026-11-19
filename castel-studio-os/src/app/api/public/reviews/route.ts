import { rateLimit } from "@/lib/rate-limit";
import { publicBusiness } from "@/server/services/online-booking";
import { ReviewError, publicReviews, submitReview, submitReviewByPhone } from "@/server/services/reviews";
import { clientIp } from "../booking/errors";
import { preflight, withCors } from "../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Published reviews (public information only: first name + initial, stars, text, date). */
export async function GET(req: Request) {
  if (!rateLimit(`rvlist:${clientIp(req)}`, 60, 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const b = await publicBusiness();
  if (!b) return withCors(req, Response.json({ count: 0, average: null, items: [] }));
  return withCors(req, Response.json(await publicReviews(b.id), { headers: { "Cache-Control": "no-store" } }));
}

/** Leave or edit a review: with the private booking link token, or with the phone number this device already knows. */
export async function POST(req: Request) {
  if (!rateLimit(`rvpost:${clientIp(req)}`, 8, 10 * 60_000).ok) return withCors(req, Response.json({ error: "rate_limited" }, { status: 429 }));
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; phone?: unknown; rating?: unknown; text?: unknown; name?: unknown; website?: unknown };
  if (body.website) return withCors(req, Response.json({ ok: true })); // honeypot: bots fill hidden fields
  try {
    const input = { rating: body.rating, text: body.text, name: body.name };
    const r = body.token ? await submitReview(String(body.token), input) : await submitReviewByPhone(body.phone, input);
    return withCors(req, Response.json({ ok: true, status: r.status }));
  } catch (e) {
    if (e instanceof ReviewError) return withCors(req, Response.json({ error: e.message }, { status: e.message === "not_found" ? 404 : 400 }));
    throw e;
  }
}
