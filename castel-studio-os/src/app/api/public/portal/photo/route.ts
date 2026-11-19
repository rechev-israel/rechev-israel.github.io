import { rateLimit } from "@/lib/rate-limit";
import { PortalError, portalPhoto } from "@/server/services/my-castel";
import { clientIp } from "../../booking/errors";
import { preflight, withCors } from "../../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** A private photo, only for the device of the customer who owns it (POST, so the key never sits in a URL or a log). */
export async function POST(req: Request) {
  if (!rateLimit(`portalph:${clientIp(req)}`, 240, 60_000).ok) return withCors(req, new Response(null, { status: 429 }));
  const body = (await req.json().catch(() => ({}))) as { device?: unknown; id?: unknown };
  try {
    const p = await portalPhoto(body.device, body.id);
    return withCors(req, new Response(new Uint8Array(p.data), { headers: { "Content-Type": p.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }));
  } catch (e) {
    if (e instanceof PortalError) return withCors(req, new Response(null, { status: e.message === "unauthorized" ? 401 : 404 }));
    throw e;
  }
}
