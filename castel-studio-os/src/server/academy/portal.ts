import { createHash, randomBytes } from "node:crypto";

export function newPortalToken() {
  const token = randomBytes(24).toString("base64url"); // 192 bits
  return { token, hash: hashPortalToken(token) };
}

export function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isPlausibleToken(t: string) {
  return /^[A-Za-z0-9_-]{32}$/.test(t);
}
