"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, passwordPolicyError } from "@/server/auth/password";
import { createSession, destroySession, requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { getI18n, LOCALE_COOKIE, THEME_COOKIE } from "@/i18n";
import type { ActionState } from "@/lib/validation";
import { lookup } from "./util";

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
// Constant-time-ish path for unknown users
const DUMMY_HASH = "$2b$12$DtGuDaLBAGbNgVdRVuwj5e3VBDkps/4JXbJgcHgs.Ig.NtVnQl4aq";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getI18n();
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }).safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (!parsed.success) return { error: t.auth.invalid };
  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    await verifyPassword(password, DUMMY_HASH);
    return { error: t.auth.invalid };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: t.auth.locked };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await audit({ businessId: user.businessId, userId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id });
    return { error: failed >= LOCK_AFTER ? t.auth.locked : t.auth.invalid };
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ businessId: user.businessId, userId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function setPreferenceAction(fd: FormData) {
  const jar = await cookies();
  const locale = fd.get("locale");
  const theme = fd.get("theme");
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  if (locale === "he" || locale === "en") jar.set(LOCALE_COOKIE, locale, opts);
  if (theme === "dark" || theme === "light") jar.set(THEME_COOKIE, theme, opts);
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const { t } = await getI18n();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: t.settings.wrongPassword, fieldErrors: { current: t.settings.wrongPassword } };
  const policy = passwordPolicyError(next);
  if (policy) return { error: lookup(t, policy), fieldErrors: { next: lookup(t, policy) ?? "" } };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  // Invalidate all other sessions
  await db.session.deleteMany({ where: { userId: me.id } });
  await createSession(me.id);
  await audit({ businessId: me.businessId, userId: me.id, action: "auth.password_change", entityType: "User", entityId: me.id });
  return { ok: true, message: t.common.saved };
}
