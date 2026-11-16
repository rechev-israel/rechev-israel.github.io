import "server-only";
import { ZodError } from "zod";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n";
import type { Dictionary } from "@/i18n/he";
import { ForbiddenError } from "@/server/auth/rbac";
import { DomainError } from "@/server/services/crm";
import { logger } from "@/lib/logger";
import type { ActionState } from "@/lib/validation";

export function lookup(t: Dictionary, key: string): string | undefined {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), t);
  return typeof v === "string" ? v : undefined;
}

/** Run a server action body with uniform, translated error handling. */
export async function runAction(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  const { t } = await getI18n();
  try {
    return (await fn()) ?? { ok: true, message: t.common.saved };
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of err.issues) {
        const k = i.path.join(".") || "_";
        fieldErrors[k] ??= lookup(t, i.message) ?? (i.code === "invalid_type" || i.code === "too_small" ? t.common.required : i.message);
      }
      return { error: t.errors.validation, fieldErrors };
    }
    if (err instanceof DomainError) {
      const msg = lookup(t, err.code) ?? t.errors.generic;
      return { error: msg, fieldErrors: err.field ? { [err.field]: msg } : undefined };
    }
    if (err instanceof ForbiddenError) return { error: t.errors.forbidden };
    logger.error("action.failed", { err: String(err), stack: err instanceof Error ? err.stack : undefined });
    return { error: t.errors.generic };
  }
}

export { redirect };
