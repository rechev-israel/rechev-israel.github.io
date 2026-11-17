import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { caliBatchSchema, applyCaliEvents } from "@/server/integrations/cali/sync";
import { verifySignature } from "@/server/integrations/cali/signature";

export const maxDuration = 60;

/**
 * Inbound sync endpoint for the Cali booking app (or an authorised bridge acting for it).
 * Security: HMAC-SHA256 signature with CALI_WEBHOOK_SECRET over `${timestamp}.${body}`, 5-minute replay window,
 * rate limit, strict schema, idempotent upserts. Disabled (503) until the secret is configured.
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`cali-webhook:${ip}`, 120, 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  const secret = process.env.CALI_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "integration_not_configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 2_000_000) return Response.json({ error: "too_large" }, { status: 413 });
  const v = verifySignature({ secret, timestamp: req.headers.get("x-castel-timestamp"), signature: req.headers.get("x-castel-signature"), rawBody: raw });
  if (!v.ok) {
    logger.warn("cali.webhook_rejected", { reason: v.reason, ip });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "bad_json" }, { status: 400 }); }
  const parsed = caliBatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation", issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  const business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) return Response.json({ error: "unavailable" }, { status: 503 });
  const r = await applyCaliEvents(business.id, parsed.data.events, "webhook");
  logger.info("cali.webhook_applied", { received: r.received, created: r.created, updated: r.updated, failed: r.failed });
  return Response.json({ ok: true, received: r.received, created: r.created, updated: r.updated, unchanged: r.unchanged, failed: r.failed, errors: r.errors }, { status: r.failed && r.failed === r.received ? 422 : 200 });
}
