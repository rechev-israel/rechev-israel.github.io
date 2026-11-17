"use server";
import { timingSafeEqual, createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, passwordPolicyError } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { ensureBaseData } from "@/server/services/bootstrap";
import { rateLimit } from "@/lib/rate-limit";
import { getI18n } from "@/i18n";
import type { ActionState } from "@/lib/validation";
import { lookup } from "./util";

function tokenMatches(given: string) {
  const expected = process.env.SETUP_TOKEN?.trim();
  if (!expected || expected.length < 12) return false;
  // Phones often add a space when pasting; compare trimmed values.
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** True only while the system has no users AND a SETUP_TOKEN is configured. */
export async function setupAvailable() {
  return Boolean(process.env.SETUP_TOKEN?.trim()) && (await db.user.count()) === 0;
}

/** One-time first-run setup: creates base data and the OWNER account, then signs in. */
export async function setupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, locale } = await getI18n();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`setup:${ip}`, 10, 15 * 60_000).ok) return { error: t.auth.locked };
  if (!(await setupAvailable())) return { error: t.errors.forbidden };
  if (!tokenMatches(String(fd.get("token") ?? ""))) return { error: t.errors.forbidden, fieldErrors: { token: "✕" } };

  const parsed = z
    .object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) })
    .safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: t.errors.validation, fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), t.common.required])) };
  const policy = passwordPolicyError(parsed.data.password);
  if (policy) return { error: lookup(t, policy), fieldErrors: { password: lookup(t, policy) ?? "" } };

  const business = await ensureBaseData(db);
  // Re-check inside the critical section to avoid two concurrent setups creating two owners.
  const user = await db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) return null;
    return tx.user.create({
      data: { businessId: business.id, email: parsed.data.email, name: parsed.data.name, role: "OWNER", locale, passwordHash: await hashPassword(parsed.data.password) },
    });
  }, { isolationLevel: "Serializable" });
  if (!user) return { error: t.errors.forbidden };
  await audit({ businessId: business.id, userId: user.id, action: "setup.owner_created", entityType: "User", entityId: user.id });
  await createSession(user.id);
  redirect("/dashboard");
}
