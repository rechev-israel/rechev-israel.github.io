import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import { cancelFromPortal } from "@/server/services/customer-portal";
import { deletePhoto, joinWaitlist, leaveWaitlist, recordReferral, saveHaircutProfile, updatePhoto, uploadPhoto } from "@/server/services/experience";
import { PortalError, portalCustomer, portalIcs, portalOverview, portalReview, referralByPhone } from "@/server/services/my-castel";
import { findByToken } from "@/server/services/online-booking";
import { ReviewError } from "@/server/services/reviews";
import { clientIp } from "../booking/errors";
import { preflight, withCors } from "../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

type Body = Record<string, unknown> & { device?: unknown; action?: unknown };
const json = (req: Request, data: unknown, status = 200) => withCors(req, Response.json(data, { status, headers: { "Cache-Control": "no-store" } }));

/**
 * MY CASTEL API. One endpoint, one device key per call (sent in the body, never in the URL).
 * Every action resolves the customer from that key on the server — the browser never chooses whose data it gets.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`portal:${ip}`, 90, 60_000).ok) return json(req, { error: "rate_limited" }, 429);
  const body = (await req.json().catch(() => ({}))) as Body;
  const action = String(body.action ?? "");
  try {
    switch (action) {
      case "overview": return json(req, await portalOverview(body.device));
      case "ics": return withCors(req, new Response(await portalIcs(body.device, body.appointmentId), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } }));
      case "cancel": { const r = await cancelFromPortal(body.device, body.appointmentId); return json(req, r, r.ok ? 200 : 400); }
      case "review": { const r = await portalReview(body.device, body.appointmentId, body as never); return json(req, { ok: true, status: r.status }); }
      case "haircut.save": { const c = await portalCustomer(body.device); await saveHaircutProfile(c.businessId, c.id, (body.profile ?? {}) as Record<string, unknown>); return json(req, { ok: true }); }
      case "photo.upload": {
        if (!rateLimit(`portalup:${ip}`, 20, 10 * 60_000).ok) return json(req, { error: "rate_limited" }, 429);
        const c = await portalCustomer(body.device);
        return json(req, { ok: true, id: (await uploadPhoto(c.businessId, c.id, body.dataUrl, body.note)).id });
      }
      case "photo.update": { const c = await portalCustomer(body.device); await updatePhoto(c.id, body.id, body as never); return json(req, { ok: true }); }
      case "photo.delete": { const c = await portalCustomer(body.device); await deletePhoto(c.id, body.id); return json(req, { ok: true }); }
      case "waitlist.join": { const c = await portalCustomer(body.device); const e = await joinWaitlist(c.businessId, c.id, body as never); await audit({ businessId: c.businessId, userId: null, action: "waitlist.joined", entityType: "WaitlistEntry", entityId: e.id }); return json(req, { ok: true }); }
      case "waitlist.leave": { const c = await portalCustomer(body.device); await leaveWaitlist(c.id, body.id); return json(req, { ok: true }); }
      case "referral.phone": {
        if (!rateLimit(`portalrefph:${ip}`, 20, 60_000).ok) return json(req, { error: "rate_limited" }, 429);
        return json(req, await referralByPhone(body.phone));
      }
      case "referral.claim": {
        // Right after booking with a friend's link: proven by the new booking's private token (no device needed).
        if (!rateLimit(`portalref:${ip}`, 10, 10 * 60_000).ok) return json(req, { error: "rate_limited" }, 429);
        const a = typeof body.token === "string" ? await findByToken(body.token) : null;
        if (!a) return json(req, { error: "not_found" }, 404);
        return json(req, await recordReferral(body.code, a));
      }
      default: return json(req, { error: "unknown_action" }, 400);
    }
  } catch (e) {
    if (e instanceof PortalError || e instanceof ReviewError) return json(req, { error: e.message }, e.message === "unauthorized" ? 401 : 404);
    if (e instanceof Error && ["invalid", "too_big", "limit", "not_found", "photo"].includes(e.message)) return json(req, { error: e.message }, 400);
    logger.error("portal.failed", { action, err: String(e) });
    return json(req, { error: "server" }, 500);
  }
}
