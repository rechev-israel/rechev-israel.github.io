import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { can, ForbiddenError, type Permission } from "./rbac";
import { hydrateSecrets } from "@/server/secrets/store";

export const SESSION_COOKIE = "castel_session";

function ttlDays() {
  const n = Number(process.env.SESSION_TTL_DAYS ?? 14);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + ttlDays() * 86400_000);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: import("@prisma/client").Role;
  businessId: string;
  locale: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  // sliding activity timestamp, throttled to once per 5 minutes
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  await hydrateSecrets();
  const u = session.user;
  return { id: u.id, name: u.name, email: u.email, role: u.role, businessId: u.businessId, locale: u.locale };
}

/** For pages & server actions: redirects to /login when anonymous. */
export async function requireUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}

/** For API route handlers: verifies same-origin on mutations and returns null when unauthorised. */
export async function requireApiUser(req: Request, permission?: Permission) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return { error: Response.json({ error: "bad_origin" }, { status: 403 }) } as const;
    }
  }
  const user = await getSessionUser();
  if (!user) return { error: Response.json({ error: "unauthorized" }, { status: 401 }) } as const;
  if (permission && !can(user.role, permission)) {
    return { error: Response.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  return { user } as const;
}
