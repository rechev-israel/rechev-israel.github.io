import { createHmac } from "node:crypto";
import type { IntegrationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { encrypt, decrypt, encryptionAvailable, fingerprint } from "@/server/secrets/crypto";
import { redact, secret, secretSource } from "@/server/secrets/store";

/**
 * Integration Setup Center catalog. "Connected" is shown ONLY after `verify()` succeeded against the real provider
 * with the credentials that are configured right now (a credential change invalidates the result via fingerprint).
 * Verification calls are read-only/free endpoints: they never send messages, generate media or spend money.
 */
export type Bi = { he: string; en: string };
export type VerifyResult = { status: IntegrationStatus; message: Bi; info?: Record<string, string> };
export type Field = { name: string; label: Bi; secret: boolean; required: boolean; envOnly?: boolean; placeholder?: string };
export type IntegrationDef = {
  provider: string;
  name: string;
  category: "core" | "ai" | "media" | "communications" | "social" | "booking";
  auth: "api_key" | "oauth" | "webhook" | "cron" | "core";
  fields: Field[];
  purpose: Bi;
  steps: Bi[];
  links: { label: string; href: string }[];
  cost: Bi;
  verify: () => Promise<VerifyResult>;
};

const bi = (he: string, en: string): Bi => ({ he, en });
const ok = (message: Bi, info?: Record<string, string>): VerifyResult => ({ status: "CONNECTED", message, info });
const fail = (message: Bi, info?: Record<string, string>): VerifyResult => ({ status: "ERROR", message, info });
const pending = (message: Bi, info?: Record<string, string>): VerifyResult => ({ status: "REQUIRES_AUTHORIZATION", message, info });
const TIMEOUT = 15_000;

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, body: body as Record<string, unknown> };
}

function upstreamError(body: unknown): string {
  if (!body || typeof body !== "object") return String(body ?? "").slice(0, 200);
  const b = body as { error?: unknown; detail?: unknown; message?: unknown };
  const e = b.error as { message?: string; type?: string } | string | undefined;
  const m = typeof e === "string" ? e : e?.message ?? (typeof b.detail === "string" ? b.detail : (b.detail as { message?: string })?.message) ?? (typeof b.message === "string" ? b.message : "");
  return redact(String(m || JSON.stringify(body)).slice(0, 300));
}

const httpFail = (service: string, status: number, body: unknown): VerifyResult => {
  if (status === 401) return fail(bi(`${service}: המפתח נדחה (401) — המפתח שגוי, בוטל או הועתק חלקית.`, `${service}: key rejected (401) — wrong, revoked or partially copied.`));
  if (status === 403) return fail(bi(`${service}: אין הרשאה (403) — ${upstreamError(body)}`, `${service}: forbidden (403) — ${upstreamError(body)}`));
  if (status === 429) return fail(bi(`${service}: חריגה ממגבלת קצב (429). נסו שוב בעוד דקה.`, `${service}: rate limited (429). Retry in a minute.`));
  return fail(bi(`${service}: שגיאה ${status} — ${upstreamError(body)}`, `${service}: error ${status} — ${upstreamError(body)}`));
};

async function guard(fn: () => Promise<VerifyResult>): Promise<VerifyResult> {
  try { return await fn(); }
  catch (e) {
    const msg = redact(e instanceof Error ? e.message : String(e));
    const timeout = /abort|timeout/i.test(msg);
    return fail(timeout ? bi("הספק לא הגיב בזמן (timeout). בדקו חיבור רשת ונסו שוב.", "Provider timed out. Check network and retry.") : bi(`שגיאת רשת: ${msg}`, `Network error: ${msg}`));
  }
}

// ── Anthropic ────────────────────────────────────────────────────────────────
async function verifyAnthropic(): Promise<VerifyResult> {
  const key = secret("ANTHROPIC_API_KEY");
  const model = secret("ANTHROPIC_MODEL") || "claude-opus-5-5";
  const h = { "x-api-key": key, "anthropic-version": "2023-06-01" };
  const list = await getJson("https://api.anthropic.com/v1/models?limit=100", h);
  if (list.status !== 200) return httpFail("Anthropic", list.status, list.body);
  const m = await getJson(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, h);
  if (m.status === 404) {
    const ids = ((list.body.data as { id: string }[]) ?? []).map((x) => x.id).slice(0, 8).join(", ");
    return fail(bi(`המפתח תקין, אבל המודל "${model}" לא זמין לחשבון. מודלים זמינים: ${ids}. עדכנו ANTHROPIC_MODEL.`, `Key is valid but model "${model}" is not available to this account. Available: ${ids}. Update ANTHROPIC_MODEL.`));
  }
  if (m.status !== 200) return httpFail("Anthropic", m.status, m.body);
  const budget = secret("AI_MONTHLY_BUDGET_USD");
  return ok(bi("המפתח אומת מול Anthropic והמודל זמין. סוכני ה-AI פעילים.", "Key verified with Anthropic and the model is available. AI agents are live."), {
    model: String(m.body.display_name ?? model),
    budget: budget ? `$${budget}/month` : "no cap (set AI_MONTHLY_BUDGET_USD)",
  });
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
async function verifyOpenAI(): Promise<VerifyResult> {
  const h = { Authorization: `Bearer ${secret("OPENAI_API_KEY")}` };
  const list = await getJson("https://api.openai.com/v1/models", h);
  if (list.status !== 200) return httpFail("OpenAI", list.status, list.body);
  const model = secret("OPENAI_IMAGE_MODEL") || "gpt-image-1";
  const m = await getJson(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, h);
  if (m.status === 404) return fail(bi(`המפתח תקין, אבל מודל התמונות "${model}" לא זמין לארגון (ייתכן שנדרש אימות ארגון ב-OpenAI).`, `Key valid, but image model "${model}" is not available (OpenAI organization verification may be required).`));
  if (m.status !== 200) return httpFail("OpenAI", m.status, m.body);
  return ok(bi("המפתח אומת ומודל התמונות זמין.", "Key verified and the image model is available."), { model });
}

// ── Replicate ────────────────────────────────────────────────────────────────
const REPLICATE_MODELS = ["REPLICATE_MODEL_IMAGE", "REPLICATE_MODEL_IMAGE_EDIT", "REPLICATE_MODEL_VIDEO", "REPLICATE_MODEL_ANIMATION", "REPLICATE_MODEL_3D", "REPLICATE_MODEL_AVATAR"];
async function verifyReplicate(): Promise<VerifyResult> {
  const h = { Authorization: `Bearer ${secret("REPLICATE_API_TOKEN")}` };
  const acc = await getJson("https://api.replicate.com/v1/account", h);
  if (acc.status !== 200) return httpFail("Replicate", acc.status, acc.body);
  const info: Record<string, string> = { account: String(acc.body.username ?? "") };
  const missing: string[] = [];
  let configured = 0;
  for (const k of REPLICATE_MODELS) {
    const slug = secret(k);
    if (!slug) continue;
    configured++;
    const [path] = slug.split(":");
    const [owner, name] = path.split("/");
    if (!owner || !name) { missing.push(`${k}=${slug}`); continue; }
    const r = await getJson(`https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, h);
    if (r.status === 200) info[k.replace("REPLICATE_MODEL_", "model ").toLowerCase()] = path;
    else missing.push(`${k}=${slug}`);
  }
  if (missing.length) return fail(bi(`הטוקן תקין, אבל מודלים לא נמצאו: ${missing.join(", ")}`, `Token valid, but models not found: ${missing.join(", ")}`), info);
  if (!configured) return pending(bi("הטוקן אומת. כדי להשתמש בפועל בחרו מודל לפחות לסוג אחד (למשל REPLICATE_MODEL_IMAGE).", "Token verified. Choose at least one model (e.g. REPLICATE_MODEL_IMAGE) to use it."), info);
  return ok(bi("הטוקן והמודלים אומתו מול Replicate.", "Token and models verified with Replicate."), info);
}

// ── ElevenLabs ───────────────────────────────────────────────────────────────
async function verifyElevenLabs(): Promise<VerifyResult> {
  const h = { "xi-api-key": secret("ELEVENLABS_API_KEY") };
  const voice = secret("ELEVENLABS_VOICE_ID");
  const v = await getJson(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voice)}`, h);
  if (v.status === 404 || v.status === 400) return fail(bi(`המפתח התקבל אבל הקול "${voice}" לא נמצא בחשבון. העתיקו Voice ID מ-ElevenLabs → Voices.`, `Key accepted but voice "${voice}" was not found. Copy a Voice ID from ElevenLabs → Voices.`));
  if (v.status !== 200) return httpFail("ElevenLabs", v.status, v.body);
  const info: Record<string, string> = { voice: String(v.body.name ?? voice) };
  const twin = secret("ELEVENLABS_TWIN_VOICE_ID");
  if (twin) {
    const t = await getJson(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(twin)}`, h);
    if (t.status !== 200) return fail(bi(`קול התאום "${twin}" לא נמצא.`, `Twin voice "${twin}" not found.`), info);
    info.twinVoice = String(t.body.name ?? twin);
  }
  return ok(bi("המפתח והקול אומתו מול ElevenLabs.", "Key and voice verified with ElevenLabs."), info);
}

// ── Meta (OAuth: Instagram + Facebook Pages + Ads) ───────────────────────────
export const META_GRAPH = "https://graph.facebook.com/v21.0";
export const META_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_manage_insights", "business_management", "ads_read"];
export function metaToken() { return secret("META_ACCESS_TOKEN"); }
export function appSecretProof(token: string) {
  const s = secret("META_APP_SECRET");
  return s ? createHmac("sha256", s).update(token).digest("hex") : "";
}
async function verifyMeta(): Promise<VerifyResult> {
  const token = metaToken();
  if (!token) return pending(bi("מזהה וסוד האפליקציה מוגדרים. לחצו ״התחברות עם Facebook״ כדי לאשר גישה (OAuth).", "App ID and secret set. Click \"Connect with Facebook\" to authorize (OAuth)."));
  const proof = appSecretProof(token);
  const q = `access_token=${encodeURIComponent(token)}${proof ? `&appsecret_proof=${proof}` : ""}`;
  const me = await getJson(`${META_GRAPH}/me?fields=id,name&${q}`);
  if (me.status !== 200) {
    const err = (me.body.error as { code?: number }) ?? {};
    if (err.code === 190) return fail(bi("הטוקן של Meta פג תוקף או בוטל. התחברו מחדש עם Facebook.", "Meta token expired or revoked. Reconnect with Facebook."));
    return httpFail("Meta", me.status, me.body);
  }
  const pages = await getJson(`${META_GRAPH}/me/accounts?fields=name,instagram_business_account{username}&limit=25&${q}`);
  const list = ((pages.body.data as { name: string; instagram_business_account?: { username?: string } }[]) ?? []);
  const ig = list.map((p) => p.instagram_business_account?.username).filter(Boolean);
  const info: Record<string, string> = { user: String(me.body.name ?? ""), pages: list.map((p) => p.name).join(", ") || "—", instagram: ig.map((u) => `@${u}`).join(", ") || "—" };
  if (!ig.length) return pending(bi("החיבור ל-Meta אומת, אבל לא נמצא חשבון Instagram Business המקושר לעמוד. קשרו את @castel.cutzz לעמוד הפייסבוק והתחברו מחדש.", "Meta connection verified, but no Instagram Business account is linked to a Page. Link the Instagram account to the Facebook Page and reconnect."), info);
  return ok(bi("החיבור ל-Meta ול-Instagram אומת. פרסום יתבצע רק דרך מרכז האישורים.", "Meta and Instagram verified. Publishing only goes through Approvals."), info);
}

// ── WhatsApp Cloud API ───────────────────────────────────────────────────────
async function verifyWhatsApp(): Promise<VerifyResult> {
  const id = secret("WHATSAPP_PHONE_NUMBER_ID");
  const v = secret("WHATSAPP_API_VERSION") || "v21.0";
  const r = await getJson(`https://graph.facebook.com/${v}/${encodeURIComponent(id)}?fields=display_phone_number,verified_name,quality_rating,name_status`, { Authorization: `Bearer ${secret("WHATSAPP_CLOUD_ACCESS_TOKEN")}` });
  if (r.status !== 200) {
    const err = (r.body.error as { code?: number }) ?? {};
    if (err.code === 190) return fail(bi("טוקן WhatsApp פג תוקף או בוטל. צרו System User token קבוע ב-Meta Business.", "WhatsApp token expired or revoked. Create a permanent System User token in Meta Business."));
    if (err.code === 100) return fail(bi(`מזהה מספר הטלפון "${id}" לא נמצא או שאין לטוקן גישה אליו.`, `Phone number ID "${id}" not found or not accessible with this token.`));
    return httpFail("WhatsApp", r.status, r.body);
  }
  const sending = process.env.WHATSAPP_SENDING_ENABLED === "true";
  return ok(bi(`החיבור אומת (ללא שליחת הודעה). שליחה: ${sending ? "מופעלת" : "מושבתת עד הסרת הגבלת החשבון"}.`, `Connection verified (no message sent). Sending: ${sending ? "enabled" : "disabled until the account restriction is lifted"}.`), {
    number: String(r.body.display_phone_number ?? ""), name: String(r.body.verified_name ?? ""), quality: String(r.body.quality_rating ?? "—"), sending: sending ? "on" : "off (kill switch)",
  });
}

// ── SMTP ─────────────────────────────────────────────────────────────────────
async function verifySmtp(): Promise<VerifyResult> {
  const nodemailer = await import("nodemailer");
  const url = secret("SMTP_URL");
  let host = "";
  try { host = new URL(url).hostname; } catch { return fail(bi("SMTP_URL לא תקין. פורמט: smtps://user:password@smtp.example.com:465", "Invalid SMTP_URL. Format: smtps://user:password@smtp.example.com:465")); }
  const t = nodemailer.createTransport(url, { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 } as never);
  try { await t.verify(); }
  catch (e) {
    const msg = redact(String(e));
    if (/auth|535|534|credentials/i.test(msg)) return fail(bi(`השרת ${host} דחה את שם המשתמש/סיסמה. ב-Gmail נדרשת ״סיסמת אפליקציה״.`, `${host} rejected the username/password. Gmail requires an App Password.`));
    return fail(bi(`לא ניתן להתחבר ל-${host}: ${msg}`, `Could not connect to ${host}: ${msg}`));
  } finally { t.close(); }
  const from = secret("SMTP_FROM");
  return ok(bi("ההתחברות לשרת הדואר והאימות הצליחו (לא נשלח מייל).", "Connected and authenticated with the mail server (no email sent)."), { host, from: from || "— (set SMTP_FROM)" });
}

// ── Cali ─────────────────────────────────────────────────────────────────────
async function verifyCali(): Promise<VerifyResult> {
  const last = await db.syncLog.findFirst({ where: { source: "cali", channel: "webhook" }, orderBy: { createdAt: "desc" } });
  const ok200 = await db.syncLog.findFirst({ where: { source: "cali", channel: "webhook", received: { gt: 0 } }, orderBy: { createdAt: "desc" } });
  if (!last) return pending(bi("נקודת הקליטה מוכנה ומאובטחת. ממתין לאירוע חתום ראשון מספק Cali (לקאלי אין API ציבורי — נדרש שיתוף פעולה של הספק). ייבוא CSV זמין כבר עכשיו.", "Endpoint ready and secured. Waiting for the first signed event from the Cali vendor (no public API — vendor cooperation needed). CSV import is available now."));
  if (ok200 && (ok200.failed ?? 0) < (ok200.received ?? 0)) return ok(bi("התקבלו אירועים חתומים מ-Cali והסנכרון פעיל.", "Signed events received from Cali; sync is live."), { lastEvent: ok200.createdAt.toISOString() });
  return fail(bi("התקבלו אירועים מ-Cali אבל כולם נכשלו. בדקו את יומן הסנכרון בעמוד ייבוא תורים.", "Events arrived from Cali but all failed. Check the sync log on the bookings import page."), { lastEvent: last.createdAt.toISOString() });
}

// ── Vercel Cron ──────────────────────────────────────────────────────────────
export const CRON_RUN_PROVIDER = "vercel-cron-run";
export async function recordCronRun(result: Record<string, unknown>, userAgent: string | null) {
  for (const b of await db.business.findMany({ select: { id: true } })) {
    const config = { at: new Date().toISOString(), viaVercel: /vercel-cron/i.test(userAgent ?? ""), ms: Number(result.ms ?? 0) } as Prisma.InputJsonValue;
    await db.integration.upsert({
      where: { businessId_provider: { businessId: b.id, provider: CRON_RUN_PROVIDER } },
      create: { businessId: b.id, provider: CRON_RUN_PROVIDER, status: "CONNECTED", lastCheckAt: new Date(), config },
      update: { status: "CONNECTED", lastCheckAt: new Date(), config },
    });
  }
}
async function verifyCron(): Promise<VerifyResult> {
  const run = await db.integration.findFirst({ where: { provider: CRON_RUN_PROVIDER }, orderBy: { lastCheckAt: "desc" } });
  const c = (run?.config ?? {}) as { at?: string; viaVercel?: boolean };
  if (!c.at) return pending(bi("CRON_SECRET מוגדר. ממתין להרצה הראשונה של Vercel Cron (כל יום ב-05:00 UTC, אחרי פריסה).", "CRON_SECRET is set. Waiting for the first Vercel Cron run (daily at 05:00 UTC, after deploy)."));
  const ageH = (Date.now() - new Date(c.at).getTime()) / 3_600_000;
  if (ageH > 26) return fail(bi(`ההרצה האחרונה הייתה לפני ${Math.round(ageH)} שעות — המתזמן לא רץ כמצופה. בדקו Vercel → Cron Jobs.`, `Last run was ${Math.round(ageH)}h ago — scheduler is not running. Check Vercel → Cron Jobs.`), { lastRun: c.at });
  return ok(bi("המתזמן היומי רץ בהצלחה ב-24 השעות האחרונות.", "The daily scheduler ran successfully in the last 24 hours."), { lastRun: c.at, source: c.viaVercel ? "Vercel Cron" : "manual" });
}

// ── Core ─────────────────────────────────────────────────────────────────────
async function verifyEncryption(): Promise<VerifyResult> {
  if (!encryptionAvailable()) return fail(bi("SECRETS_ENCRYPTION_KEY חסר או קצר מ-32 תווים.", "SECRETS_ENCRYPTION_KEY missing or shorter than 32 chars."));
  const probe = "castel-probe";
  if (decrypt(encrypt(probe)) !== probe) return fail(bi("בדיקת הצפנה נכשלה.", "Encryption self-test failed."));
  const rows = await db.integrationSecret.findMany({ select: { name: true, ciphertext: true, iv: true, tag: true } });
  const bad = rows.filter((r) => { try { decrypt(r); return false; } catch { return true; } }).map((r) => r.name);
  if (bad.length) return fail(bi(`לא ניתן לפענח: ${bad.join(", ")} — המפתח הוחלף. הזינו אותם מחדש.`, `Cannot decrypt: ${bad.join(", ")} — the key changed. Re-enter them.`));
  return ok(bi("ההצפנה פעילה. ניתן לשמור מפתחות באפליקציה בצורה מוצפנת.", "Encryption active. Credentials can be stored in the app, encrypted."), { stored: String(rows.length) });
}
async function verifyPostgres(): Promise<VerifyResult> {
  await db.$queryRaw`SELECT 1`;
  return ok(bi("מסד הנתונים זמין.", "Database reachable."));
}

const F = (name: string, he: string, en: string, o: Partial<Field> = {}): Field => ({ name, label: bi(he, en), secret: true, required: true, ...o });

export const INTEGRATIONS: IntegrationDef[] = [
  {
    provider: "anthropic", name: "Anthropic Claude", category: "ai", auth: "api_key",
    fields: [F("ANTHROPIC_API_KEY", "מפתח API", "API key", { placeholder: "sk-ant-…" }), F("ANTHROPIC_MODEL", "מודל (רשות)", "Model (optional)", { secret: false, required: false, placeholder: "claude-opus-5-5" }), F("AI_MONTHLY_BUDGET_USD", "תקרת הוצאה חודשית ($)", "Monthly spend cap ($)", { secret: false, required: false, placeholder: "30" })],
    purpose: bi("מפעיל את מחלקת סוכני ה-AI: מנכ״ל, שיווק, מכירות, כספים, תמיכה, אקדמיה, קריאייטיב ואוטומציה.", "Powers the AI Agents department: CEO, marketing, sales, finance, support, academy, creative, automation."),
    steps: [bi("היכנסו ל-platform.claude.com → Settings → API Keys → Create Key.", "Go to platform.claude.com → Settings → API Keys → Create Key."), bi("ודאו שיש אמצעי תשלום/קרדיט ב-Billing (שימוש בתשלום לפי צריכה).", "Make sure Billing has a payment method/credits (pay-as-you-go)."), bi("הדביקו את המפתח כאן (נשמר מוצפן) או ב-Vercel → Settings → Environment Variables בשם ANTHROPIC_API_KEY.", "Paste the key here (stored encrypted) or in Vercel → Settings → Environment Variables as ANTHROPIC_API_KEY."), bi("מומלץ להגדיר תקרה חודשית לפני הפעלה.", "Set a monthly cap before going live."), bi("לחצו ״בדיקת חיבור״.", "Click \"Test connection\".")],
    links: [{ label: "platform.claude.com", href: "https://platform.claude.com/settings/keys" }],
    cost: bi("בתשלום לפי שימוש. הבדיקה עצמה חינמית (רשימת מודלים).", "Pay per use. The test itself is free (model listing)."),
    verify: verifyAnthropic,
  },
  {
    provider: "openai", name: "OpenAI Images", category: "media", auth: "api_key",
    fields: [F("OPENAI_API_KEY", "מפתח API", "API key", { placeholder: "sk-…" }), F("OPENAI_IMAGE_MODEL", "מודל תמונות (רשות)", "Image model (optional)", { secret: false, required: false, placeholder: "gpt-image-1" })],
    purpose: bi("יצירת תמונות בסטודיו הקריאייטיב.", "Image generation in the Creative Studio."),
    steps: [bi("platform.openai.com → API keys → Create new secret key.", "platform.openai.com → API keys → Create new secret key."), bi("ל-gpt-image-1 ייתכן שנדרש אימות ארגון (Organization → Verify).", "gpt-image-1 may require organization verification."), bi("הדביקו כאן ולחצו ״בדיקת חיבור״.", "Paste here and click \"Test connection\".")],
    links: [{ label: "platform.openai.com", href: "https://platform.openai.com/api-keys" }],
    cost: bi("בתשלום לפי תמונה. הבדיקה חינמית.", "Paid per image. The test is free."),
    verify: verifyOpenAI,
  },
  {
    provider: "replicate", name: "Replicate", category: "media", auth: "api_key",
    fields: [F("REPLICATE_API_TOKEN", "API token", "API token", { placeholder: "r8_…" }), ...REPLICATE_MODELS.map((k) => F(k, `מודל: ${k.replace("REPLICATE_MODEL_", "").toLowerCase()}`, `Model: ${k.replace("REPLICATE_MODEL_", "").toLowerCase()}`, { secret: false, required: false, placeholder: "owner/model" }))],
    purpose: bi("וידאו, אנימציה, עריכת תמונה, תלת-ממד ואווטאר בסטודיו.", "Video, animation, image edit, 3D and avatar in the studio."),
    steps: [bi("replicate.com → Account → API tokens → Create token.", "replicate.com → Account → API tokens → Create token."), bi("בחרו מודל לכל סוג (למשל black-forest-labs/flux-schnell לתמונות).", "Pick a model per type (e.g. black-forest-labs/flux-schnell for images)."), bi("לחצו ״בדיקת חיבור״ — נבדק גם שהמודלים קיימים.", "Click \"Test connection\" — models are checked too.")],
    links: [{ label: "replicate.com", href: "https://replicate.com/account/api-tokens" }],
    cost: bi("בתשלום לפי הרצה. הבדיקה חינמית.", "Paid per run. The test is free."),
    verify: verifyReplicate,
  },
  {
    provider: "elevenlabs", name: "ElevenLabs", category: "media", auth: "api_key",
    fields: [F("ELEVENLABS_API_KEY", "מפתח API", "API key"), F("ELEVENLABS_VOICE_ID", "Voice ID לקריינות", "Voice-over Voice ID", { secret: false }), F("ELEVENLABS_TWIN_VOICE_ID", "Voice ID של התאום (רשות, בהסכמה)", "Twin Voice ID (optional, consent)", { secret: false, required: false })],
    purpose: bi("קריינות בעברית/אנגלית, וקול התאום הדיגיטלי בהסכמה.", "Voice-overs, and the Digital Twin voice with consent."),
    steps: [bi("elevenlabs.io → Developers → API Keys → Create (הרשאת Voices: Read, Text to Speech).", "elevenlabs.io → Developers → API Keys → Create (Voices: Read, Text to Speech)."), bi("העתיקו Voice ID מ-Voices.", "Copy a Voice ID from Voices."), bi("לחצו ״בדיקת חיבור״.", "Click \"Test connection\".")],
    links: [{ label: "elevenlabs.io", href: "https://elevenlabs.io/app/settings/api-keys" }],
    cost: bi("לפי מנוי/תווים. הבדיקה חינמית.", "Subscription/characters. The test is free."),
    verify: verifyElevenLabs,
  },
  {
    provider: "meta", name: "Meta — Instagram, Facebook, Ads", category: "social", auth: "oauth",
    fields: [F("META_APP_ID", "App ID", "App ID", { secret: false }), F("META_APP_SECRET", "App Secret", "App Secret")],
    purpose: bi("קריאת נתוני Instagram ועמוד הפייסבוק, ובהמשך פרסום דרך מרכז האישורים. כל הוצאה דורשת אישור.", "Read Instagram/Page data, later publishing via Approvals. Any spend needs approval."),
    steps: [bi("developers.facebook.com → My Apps → Create App (סוג Business).", "developers.facebook.com → My Apps → Create App (Business type)."), bi("Facebook Login for Business → Settings → Valid OAuth Redirect URIs: הכתובת שמוצגת למטה.", "Facebook Login for Business → Settings → Valid OAuth Redirect URIs: the URL shown below."), bi("App settings → Basic: העתיקו App ID ו-App Secret לכאן.", "App settings → Basic: copy App ID and App Secret here."), bi("לחצו ״התחברות עם Facebook״ ואשרו את העמוד ואת חשבון @castel.cutzz.", "Click \"Connect with Facebook\" and approve the Page and @castel.cutzz.")],
    links: [{ label: "developers.facebook.com", href: "https://developers.facebook.com/apps/" }],
    cost: bi("החיבור חינמי. פרסום ממומן — רק באישורכם.", "Connecting is free. Paid ads — only with your approval."),
    verify: verifyMeta,
  },
  {
    provider: "whatsapp", name: "WhatsApp Cloud API", category: "communications", auth: "api_key",
    fields: [F("WHATSAPP_CLOUD_ACCESS_TOKEN", "System User access token", "System User access token", { placeholder: "EAA…" }), F("WHATSAPP_PHONE_NUMBER_ID", "Phone number ID", "Phone number ID", { secret: false })],
    purpose: bi("הודעות ללקוחות שאישרו קבלה, רק אחרי אישור בעלים. השליחה מושבתת כרגע (הגבלת חשבון).", "Messages to opted-in customers after owner approval. Sending is currently disabled (account restriction)."),
    steps: [bi("business.facebook.com → Settings → System users → צרו משתמש והפיקו token עם whatsapp_business_messaging.", "business.facebook.com → Settings → System users → generate a token with whatsapp_business_messaging."), bi("WhatsApp Manager → Phone numbers: העתיקו Phone number ID.", "WhatsApp Manager → Phone numbers: copy the Phone number ID."), bi("הבדיקה רק קוראת את פרטי המספר — לא נשלחת הודעה.", "The test only reads number details — no message is sent.")],
    links: [{ label: "business.facebook.com", href: "https://business.facebook.com/settings/system-users" }],
    cost: bi("הבדיקה חינמית. שיחות עסקיות בתשלום של Meta.", "Test is free. Business conversations are billed by Meta."),
    verify: verifyWhatsApp,
  },
  {
    provider: "smtp", name: "Email (SMTP)", category: "communications", auth: "api_key",
    fields: [F("SMTP_URL", "SMTP URL", "SMTP URL", { placeholder: "smtps://user:app-password@smtp.gmail.com:465" }), F("SMTP_FROM", "כתובת שולח", "From address", { secret: false, required: false, placeholder: "CASTEL STUDIO <info@…>" })],
    purpose: bi("שליחת אימיילים (אחרי אישור).", "Sending email (after approval)."),
    steps: [bi("Gmail: הפעילו אימות דו-שלבי → myaccount.google.com/apppasswords → צרו סיסמת אפליקציה.", "Gmail: enable 2-Step Verification → myaccount.google.com/apppasswords → create an App Password."), bi("פורמט: smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465", "Format: smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465"), bi("הבדיקה מתחברת ומאמתת בלבד — לא נשלח מייל.", "The test only connects and authenticates — no email is sent.")],
    links: [{ label: "Google App Passwords", href: "https://myaccount.google.com/apppasswords" }],
    cost: bi("חינמי ברוב הספקים.", "Free with most providers."),
    verify: verifySmtp,
  },
  {
    provider: "cali", name: "Cali — מערכת התורים", category: "booking", auth: "webhook",
    fields: [F("CALI_WEBHOOK_SECRET", "סוד חתימה (HMAC)", "Signing secret (HMAC)", { placeholder: "32+ random characters" })],
    purpose: bi("Cali נשארת מערכת התורים. סנכרון חי דרך webhook חתום מהספק, או ייבוא CSV.", "Cali stays the booking system. Live sync via a signed vendor webhook, or CSV import."),
    steps: [bi("צרו סוד אקראי ארוך (32+ תווים) ושמרו אותו כאן.", "Create a long random secret (32+ chars) and save it here."), bi("מסרו לספק Cali בערוץ מאובטח את הסוד ואת כתובת ה-webhook שמוצגת למטה, יחד עם CALI_INTEGRATION.md.", "Give the Cali vendor the secret and the webhook URL below over a secure channel, with CALI_INTEGRATION.md."), bi("״מחובר״ יוצג רק אחרי שיתקבל אירוע חתום אמיתי.", "\"Connected\" appears only after a real signed event arrives.")],
    links: [{ label: "Cali", href: "https://cali-b5f0e.web.app/#/aeKiKr0vCLX" }],
    cost: bi("ללא עלות מצדנו.", "No cost on our side."),
    verify: verifyCali,
  },
  {
    provider: "vercel-cron", name: "Vercel Cron — מתזמן יומי", category: "core", auth: "cron",
    fields: [F("CRON_SECRET", "CRON_SECRET", "CRON_SECRET", { envOnly: true })],
    purpose: bi("מריץ אוטומציות מתוזמנות, ניסיונות חוזרים, שליחת הודעות מאושרות ורענון עבודות קריאייטיב.", "Runs scheduled automations, retries, approved message sends and creative job refresh."),
    steps: [bi("Vercel שולח את CRON_SECRET רק ממשתני הסביבה של Vercel — לכן הוא חייב להיות שם (לא באפליקציה).", "Vercel only sends CRON_SECRET from its own env vars — so it must live there (not in the app)."), bi("Vercel → Settings → Environment Variables → CRON_SECRET = מחרוזת אקראית ארוכה.", "Vercel → Settings → Environment Variables → CRON_SECRET = long random string."), bi("אחרי פריסה, ״מחובר״ יוצג אחרי ההרצה הראשונה (05:00 UTC).", "After deploy, \"Connected\" appears after the first run (05:00 UTC).")],
    links: [{ label: "Vercel Cron Jobs", href: "https://vercel.com/docs/cron-jobs" }],
    cost: bi("כלול ב-Vercel.", "Included in Vercel."),
    verify: verifyCron,
  },
  {
    provider: "encryption", name: "הצפנת מפתחות", category: "core", auth: "core",
    fields: [F("SECRETS_ENCRYPTION_KEY", "SECRETS_ENCRYPTION_KEY", "SECRETS_ENCRYPTION_KEY", { envOnly: true })],
    purpose: bi("מאפשר לשמור מפתחות API בתוך האפליקציה בהצפנת AES-256-GCM.", "Allows storing API keys inside the app with AES-256-GCM."),
    steps: [bi("Vercel → Environment Variables → SECRETS_ENCRYPTION_KEY = 48+ תווים אקראיים. אסור לשנות אחר כך (מפתחות שמורים לא יפוענחו).", "Vercel → Environment Variables → SECRETS_ENCRYPTION_KEY = 48+ random chars. Do not change it later (stored keys would not decrypt).")],
    links: [],
    cost: bi("חינמי.", "Free."),
    verify: verifyEncryption,
  },
  {
    provider: "postgres", name: "PostgreSQL (Neon)", category: "core", auth: "core",
    fields: [F("DATABASE_URL", "DATABASE_URL", "DATABASE_URL", { envOnly: true })],
    purpose: bi("מסד הנתונים הראשי.", "Primary database."), steps: [], links: [], cost: bi("לפי תוכנית Neon.", "Per Neon plan."),
    verify: verifyPostgres,
  },
];

export const getDef = (provider: string) => INTEGRATIONS.find((i) => i.provider === provider);

function fieldValue(f: Field) {
  if (f.name === "DATABASE_URL") return process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_PRISMA_URL || process.env.POSTGRES_PRISMA_URL || "";
  return f.envOnly ? process.env[f.name]?.trim() ?? "" : secret(f.name);
}
export function fieldSource(f: Field): "env" | "app" | null {
  if (f.envOnly) return fieldValue(f) ? "env" : null;
  return secretSource(f.name);
}
export function missingRequired(def: IntegrationDef) {
  return def.fields.filter((f) => f.required && !fieldValue(f)).map((f) => f.name);
}
export function credentialFingerprint(def: IntegrationDef) {
  return fingerprint([def.provider, ...def.fields.map(fieldValue), def.provider === "meta" ? metaToken() : undefined]);
}

export type DisplayState = "connected" | "unverified" | "not_configured" | "error" | "waiting";
export type StoredCheck = { status: IntegrationStatus; lastCheckAt: Date | null; lastError: string | null; config: unknown } | null;

/** Pure: decide what the UI may claim. Connected requires a successful check for the *current* credentials. */
export function displayState(missing: string[], currentFp: string, stored: StoredCheck): DisplayState {
  if (missing.length) return "not_configured";
  const cfg = (stored?.config ?? {}) as { fp?: string };
  if (!stored || !stored.lastCheckAt || cfg.fp !== currentFp) return "unverified";
  if (stored.status === "CONNECTED") return "connected";
  if (stored.status === "ERROR") return "error";
  return "waiting";
}

/** Run the real test, persist the result (sanitized), return it. */
export async function runVerification(businessId: string, provider: string) {
  const def = getDef(provider);
  if (!def) throw new Error("unknown provider");
  const missing = missingRequired(def);
  const fp = credentialFingerprint(def);
  const result: VerifyResult = missing.length
    ? { status: "NOT_CONFIGURED", message: bi(`חסר: ${missing.join(", ")}`, `Missing: ${missing.join(", ")}`) }
    : await guard(def.verify);
  const config = { fp, message: result.message, info: result.info ?? {} } as Prisma.InputJsonValue;
  const lastError = result.status === "CONNECTED" ? null : redact(result.message.en);
  await db.integration.upsert({
    where: { businessId_provider: { businessId, provider } },
    create: { businessId, provider, status: result.status, lastCheckAt: new Date(), lastError, config },
    update: { status: result.status, lastCheckAt: new Date(), lastError, config },
  });
  return result;
}

/** Page data: no external calls; shows last verified state only. */
export async function getIntegrationOverview(businessId: string) {
  const rows = await db.integration.findMany({ where: { businessId } });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return INTEGRATIONS.map((def) => {
    const missing = missingRequired(def);
    const fp = credentialFingerprint(def);
    const stored = byProvider.get(def.provider) ?? null;
    const cfg = (stored?.config ?? {}) as { message?: Bi; info?: Record<string, string> };
    return {
      provider: def.provider, name: def.name, category: def.category, auth: def.auth, purpose: def.purpose, steps: def.steps, links: def.links, cost: def.cost,
      fields: def.fields.map((f) => ({ name: f.name, label: f.label, secret: f.secret, required: f.required, envOnly: Boolean(f.envOnly), placeholder: f.placeholder, source: fieldSource(f), value: !f.secret && !f.envOnly && fieldSource(f) ? secret(f.name) : undefined })),
      missing,
      state: displayState(missing, fp, stored),
      lastCheckAt: stored?.lastCheckAt ?? null,
      message: cfg.message ?? null,
      info: cfg.info ?? {},
      metaConnected: def.provider === "meta" ? Boolean(metaToken()) : undefined,
    };
  });
}
