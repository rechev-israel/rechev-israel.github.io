import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { audit } from "@/server/audit";
import { logger } from "@/lib/logger";
import { encryptionAvailable } from "@/server/secrets/crypto";
import { redact, saveSecret, secret } from "@/server/secrets/store";
import { META_GRAPH, runVerification } from "@/server/integrations/registry";
import { appOrigin } from "@/server/integrations/origin";

export const dynamic = "force-dynamic";

/** OAuth redirect target: verifies state, exchanges the code server-side, upgrades to a long-lived token and stores it encrypted. */
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const back = (code: string) => Response.redirect(`${origin}/integrations?meta=${code}#meta`, 303);
  const user = await getSessionUser();
  if (!user || !can(user.role, "integrations.manage")) return Response.redirect(`${origin}/login`, 303);
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("castel_meta_state")?.value ?? "";
  jar.delete({ name: "castel_meta_state", path: "/api/integrations/meta" });
  const state = url.searchParams.get("state") ?? "";
  if (!expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return back("bad_state");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("no_code");
  if (!encryptionAvailable()) return back("no_encryption");
  const appId = secret("META_APP_ID"), appSecret = secret("META_APP_SECRET");
  try {
    const q = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: `${origin}/api/integrations/meta/callback`, code });
    const r1 = await fetch(`${META_GRAPH}/oauth/access_token?${q}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const d1 = (await r1.json()) as { access_token?: string; error?: { message?: string } };
    if (!r1.ok || !d1.access_token) { logger.warn("meta.oauth_exchange_failed", { status: r1.status, err: redact(d1.error?.message ?? "") }); return back("exchange_failed"); }
    const q2 = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: d1.access_token });
    const r2 = await fetch(`${META_GRAPH}/oauth/access_token?${q2}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const d2 = (await r2.json()) as { access_token?: string };
    await saveSecret(user.businessId, "META_ACCESS_TOKEN", d2.access_token ?? d1.access_token, user.id);
    await audit({ businessId: user.businessId, userId: user.id, action: "integration.oauth_connected", entityType: "Integration", entityId: "meta", metadata: { longLived: Boolean(d2.access_token) } });
    const v = await runVerification(user.businessId, "meta");
    return back(v.status === "CONNECTED" ? "connected" : "check");
  } catch (e) {
    logger.warn("meta.oauth_failed", { err: redact(String(e)) });
    return back("exchange_failed");
  }
}
