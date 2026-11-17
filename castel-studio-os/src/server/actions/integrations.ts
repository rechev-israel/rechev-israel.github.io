"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { getI18n } from "@/i18n";
import { encryptionAvailable } from "@/server/secrets/crypto";
import { deleteSecret, hydrateSecrets, isManagedSecret, saveSecret } from "@/server/secrets/store";
import { getDef, INTEGRATIONS, runVerification } from "@/server/integrations/registry";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

/** Save credentials (encrypted) for one provider, then immediately run its real connection test. Values never come back. */
export async function saveIntegrationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState> => {
    const user = await requireUser("integrations.manage");
    const { locale } = await getI18n();
    const L = (he: string, en: string) => (locale === "he" ? he : en);
    const def = getDef(String(fd.get("provider") ?? ""));
    if (!def) return { error: "unknown provider" };
    if (!encryptionAvailable()) return { error: L("שמירה באפליקציה דורשת SECRETS_ENCRYPTION_KEY ב-Vercel. בינתיים אפשר להוסיף את המפתח ישירות ב-Vercel → Environment Variables.", "In-app storage needs SECRETS_ENCRYPTION_KEY in Vercel. Meanwhile add the key directly in Vercel → Environment Variables.") };
    const changed: string[] = [];
    // Gmail quick setup: build SMTP_URL server-side so the owner never has to hand-encode a URL on a phone.
    if (def.provider === "smtp") {
      const addr = String(fd.get("gmail_address") ?? "").trim().toLowerCase();
      const pass = String(fd.get("gmail_app_password") ?? "").replace(/\s+/g, "");
      if (addr || pass) {
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(addr)) return { error: L("כתובת Gmail לא תקינה", "Invalid Gmail address"), fieldErrors: { gmail_address: "✕" } };
        if (!/^[a-z]{16}$/i.test(pass)) return { error: L("סיסמת אפליקציה היא 16 אותיות (בלי רווחים). זו לא הסיסמה הרגילה של Gmail.", "An App Password is 16 letters (no spaces) — not your normal Gmail password."), fieldErrors: { gmail_app_password: "✕" } };
        await saveSecret(user.businessId, "SMTP_URL", `smtps://${encodeURIComponent(addr)}:${encodeURIComponent(pass)}@smtp.gmail.com:465`, user.id);
        await saveSecret(user.businessId, "SMTP_FROM", `CASTEL STUDIO <${addr}>`, user.id);
        changed.push("SMTP_URL", "SMTP_FROM");
      }
    }
    for (const f of def.fields) {
      if (f.envOnly || !isManagedSecret(f.name)) continue;
      const raw = fd.get(f.name);
      if (typeof raw !== "string") continue;
      const v = raw.trim();
      if (!v) continue; // empty = keep existing
      if (v.length > 4000 || /[\r\n]/.test(v)) return { error: L(`ערך לא תקין: ${f.name}`, `Invalid value: ${f.name}`), fieldErrors: { [f.name]: "✕" } };
      if (f.name === "AI_MONTHLY_BUDGET_USD" && !(Number(v) > 0)) return { error: L("תקרה חייבת להיות מספר חיובי", "Cap must be a positive number"), fieldErrors: { [f.name]: "✕" } };
      await saveSecret(user.businessId, f.name, v, user.id);
      changed.push(f.name);
    }
    if (!changed.length) return { error: L("לא הוזן ערך חדש.", "No new value entered.") };
    await audit({ businessId: user.businessId, userId: user.id, action: "integration.credentials_saved", entityType: "Integration", entityId: def.provider, metadata: { fields: changed } });
    const r = await runVerification(user.businessId, def.provider);
    revalidatePath("/integrations");
    const msg = locale === "he" ? r.message.he : r.message.en;
    return r.status === "CONNECTED" ? { ok: true, message: `✓ ${msg}` } : { error: `${L("נשמר מוצפן. תוצאת הבדיקה", "Saved encrypted. Test result")}: ${msg}` };
  });
}

export async function testIntegrationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("integrations.view");
    const { locale } = await getI18n();
    await hydrateSecrets(true);
    const provider = String(fd.get("provider") ?? "");
    const targets = provider === "__all" ? INTEGRATIONS.map((i) => i.provider) : getDef(provider) ? [provider] : [];
    if (!targets.length) return { error: "unknown provider" };
    const results = await Promise.all(targets.map(async (p) => ({ p, r: await runVerification(user.businessId, p) })));
    await audit({ businessId: user.businessId, userId: user.id, action: "integration.test", entityType: "Integration", entityId: provider, metadata: Object.fromEntries(results.map(({ p, r }) => [p, r.status])) });
    revalidatePath("/integrations");
    if (targets.length > 1) {
      const n = results.filter((x) => x.r.status === "CONNECTED").length;
      return { ok: true, message: locale === "he" ? `נבדקו ${targets.length} חיבורים · ${n} מחוברים` : `Tested ${targets.length} · ${n} connected` };
    }
    const r = results[0].r;
    const msg = locale === "he" ? r.message.he : r.message.en;
    return r.status === "CONNECTED" ? { ok: true, message: `✓ ${msg}` } : { error: msg };
  });
}

export async function removeIntegrationSecretAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("integrations.manage");
    const name = String(fd.get("name") ?? "");
    const provider = String(fd.get("provider") ?? "");
    if (!isManagedSecret(name) || !getDef(provider)?.fields.some((f) => f.name === name)) return { error: "invalid" };
    await deleteSecret(user.businessId, name);
    await audit({ businessId: user.businessId, userId: user.id, action: "integration.credential_removed", entityType: "Integration", entityId: provider, metadata: { field: name } });
    await runVerification(user.businessId, provider);
    revalidatePath("/integrations");
  });
}
