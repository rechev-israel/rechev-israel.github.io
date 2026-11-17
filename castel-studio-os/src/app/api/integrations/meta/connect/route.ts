import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { secret } from "@/server/secrets/store";
import { META_SCOPES } from "@/server/integrations/registry";
import { appOrigin } from "@/server/integrations/origin";

export const dynamic = "force-dynamic";

/** Starts the official Facebook Login (OAuth 2.0) flow. Owner only; CSRF-protected with a one-time state cookie. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const origin = appOrigin(req);
  if (!user || !can(user.role, "integrations.manage")) return Response.redirect(`${origin}/login`, 303);
  const appId = secret("META_APP_ID");
  if (!appId || !secret("META_APP_SECRET")) return Response.redirect(`${origin}/integrations?meta=missing_app#meta`, 303);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("castel_meta_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/meta", maxAge: 600 });
  const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", `${origin}/api/integrations/meta/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", META_SCOPES.join(","));
  return Response.redirect(u.toString(), 303);
}
