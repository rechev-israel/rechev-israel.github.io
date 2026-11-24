import { rateLimit } from "@/lib/rate-limit";
import { publicBusiness } from "@/server/services/online-booking";
import { ModelError, cancelModelByToken, modelByToken, modelDays, modelSlots, submitModelApplication } from "@/server/services/model-applications";
import { clientIp } from "../booking/errors";
import { preflight, withCors } from "../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
const json = (req: Request, data: unknown, status = 200) => withCors(req, Response.json(data, { status, headers: { "Cache-Control": "no-store" } }));
const fail = (req: Request, e: unknown) => {
  if (e instanceof ModelError) return json(req, { error: e.message }, ["disabled"].includes(e.message) ? 403 : e.message === "not_found" ? 404 : 400);
  throw e;
};

/** GET → days; ?date= → two-hour times; ?t= → the applicant's status (private link). */
export async function GET(req: Request) {
  if (!rateLimit(`model:${clientIp(req)}`, 90, 60_000).ok) return json(req, { error: "rate_limited" }, 429);
  const u = new URL(req.url), t = u.searchParams.get("t"), date = u.searchParams.get("date");
  try {
    if (t) { const a = await modelByToken(t); return a ? json(req, a) : json(req, { error: "not_found" }, 404); }
    const b = await publicBusiness();
    if (!b) return json(req, { enabled: false, days: [] });
    if (date) return json(req, { slots: await modelSlots(b.id, date) });
    return json(req, await modelDays(b.id));
  } catch (e) { return fail(req, e); }
}

/** POST {action:"submit", ...} → a pending application (never a confirmed appointment). POST {action:"cancel", t}. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (body.action === "cancel") {
      if (!rateLimit(`modelc:${ip}`, 10, 10 * 60_000).ok) return json(req, { error: "rate_limited" }, 429);
      await cancelModelByToken(body.t); return json(req, { ok: true });
    }
    if (!rateLimit(`models:${ip}`, 4, 30 * 60_000).ok) return json(req, { error: "rate_limited" }, 429);
    if (body.website) return json(req, { ok: true });
    const b = await publicBusiness();
    if (!b) return json(req, { error: "disabled" }, 403);
    const r = await submitModelApplication(b.id, body as never);
    return json(req, { ok: true, token: r.token, deviceToken: r.deviceToken }, 201);
  } catch (e) { return fail(req, e); }
}
