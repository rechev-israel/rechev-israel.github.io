import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** 32-byte key derived from SECRETS_ENCRYPTION_KEY (any long random string). */
function key() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) throw new Error("SECRETS_ENCRYPTION_KEY missing or too short");
  return createHash("sha256").update(raw).digest();
}

export function encryptionAvailable() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  return Boolean(raw && raw.length >= 32);
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

export function decrypt(x: { ciphertext: string; iv: string; tag: string }) {
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(x.iv, "base64"));
  d.setAuthTag(Buffer.from(x.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(x.ciphertext, "base64")), d.final()]).toString("utf8");
}

/** Stable, non-reversible fingerprint used to invalidate a verification when a credential changes. */
export function fingerprint(values: (string | undefined)[]) {
  return createHash("sha256").update(values.map((v) => v ?? "").join("\u0000")).digest("hex").slice(0, 24);
}
