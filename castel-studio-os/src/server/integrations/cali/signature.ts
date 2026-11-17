import { createHmac, timingSafeEqual } from "node:crypto";

/** Max age of a signed request (protects against replay). */
export const MAX_SKEW_MS = 5 * 60_000;

/** Signature = hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`)), sent as `X-Castel-Signature: sha256=<hex>`. */
export function signPayload(secret: string, timestamp: string, rawBody: string) {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifySignature(opts: { secret: string | undefined; timestamp: string | null; signature: string | null; rawBody: string; now?: number }) {
  const { secret, timestamp, signature, rawBody } = opts;
  if (!secret || secret.length < 24) return { ok: false as const, reason: "not_configured" };
  if (!timestamp || !signature) return { ok: false as const, reason: "missing_headers" };
  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs((opts.now ?? Date.now()) - ts) > MAX_SKEW_MS) return { ok: false as const, reason: "stale" };
  const expected = Buffer.from(signPayload(secret, timestamp, rawBody));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false as const, reason: "bad_signature" };
  return { ok: true as const };
}
