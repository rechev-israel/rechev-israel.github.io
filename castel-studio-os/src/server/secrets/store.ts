import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { decrypt, encrypt, encryptionAvailable } from "./crypto";

/**
 * Credential resolution: Vercel/host environment variables first, then credentials the owner entered in the app
 * (stored AES-256-GCM encrypted). Decrypted values live only in server memory and are never logged or returned
 * to the browser. Single-business deployment: the cache is process-wide.
 */
export const IN_APP_SECRETS = [
  "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_MONTHLY_BUDGET_USD",
  "OPENAI_API_KEY", "OPENAI_IMAGE_MODEL",
  "REPLICATE_API_TOKEN", "REPLICATE_MODEL_IMAGE", "REPLICATE_MODEL_IMAGE_EDIT", "REPLICATE_MODEL_VIDEO", "REPLICATE_MODEL_ANIMATION", "REPLICATE_MODEL_3D", "REPLICATE_MODEL_AVATAR",
  "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_TWIN_VOICE_ID",
  "META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN",
  "WHATSAPP_CLOUD_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
  "SMTP_URL", "SMTP_FROM",
  "CALI_WEBHOOK_SECRET",
] as const;
export type SecretName = (typeof IN_APP_SECRETS)[number];

let cache = new Map<string, string>();
let loadedAt = 0;
const TTL_MS = 60_000;

export function secret(name: string): string {
  return process.env[name]?.trim() || cache.get(name) || "";
}

export function secretSource(name: string): "env" | "app" | null {
  if (process.env[name]?.trim()) return "env";
  if (cache.get(name)) return "app";
  return null;
}

/** Load in-app credentials into memory (throttled). Safe to call on every request. */
export async function hydrateSecrets(force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  loadedAt = Date.now();
  if (!encryptionAvailable()) { cache = new Map(); return; }
  try {
    const rows = await db.integrationSecret.findMany();
    const next = new Map<string, string>();
    for (const r of rows) {
      try { next.set(r.name, decrypt(r)); }
      catch { logger.warn("secrets.decrypt_failed", { name: r.name }); }
    }
    cache = next;
  } catch (e) {
    logger.warn("secrets.load_failed", { err: String(e).slice(0, 200) });
  }
}

export function isManagedSecret(name: string): name is SecretName {
  return (IN_APP_SECRETS as readonly string[]).includes(name);
}

export async function saveSecret(businessId: string, name: SecretName, value: string, userId: string | null) {
  const v = value.trim();
  const enc = encrypt(v);
  await db.integrationSecret.upsert({
    where: { businessId_name: { businessId, name } },
    create: { businessId, name, ...enc, last4: v.length >= 12 ? v.slice(-4) : null, updatedById: userId },
    update: { ...enc, last4: v.length >= 12 ? v.slice(-4) : null, updatedById: userId },
  });
  await hydrateSecrets(true);
}

export async function deleteSecret(businessId: string, name: SecretName) {
  await db.integrationSecret.deleteMany({ where: { businessId, name } });
  await hydrateSecrets(true);
}

export async function storedSecretMeta(businessId: string) {
  const rows = await db.integrationSecret.findMany({ where: { businessId }, select: { name: true, last4: true, updatedAt: true } });
  return new Map(rows.map((r) => [r.name, r]));
}

/** Remove any credential value that might appear in an upstream error message. */
export function redact(text: string, names: readonly string[] = IN_APP_SECRETS) {
  let out = text;
  for (const n of names) {
    const v = secret(n);
    if (v && v.length >= 8) out = out.split(v).join("[redacted]");
  }
  return out.replace(/(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, "$1…").replace(/(r8_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, "$1…").replace(/(EAA[A-Za-z0-9]{4})[A-Za-z0-9]+/g, "$1…").replace(/\/\/([^:/@\s]+):([^@\s]+)@/g, "//$1:[redacted]@").slice(0, 400);
}
