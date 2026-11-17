import type { IntegrationStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type IntegrationDef = {
  provider: string;
  name: string;
  category: "core" | "ai" | "media" | "communications" | "ads" | "booking" | "social";
  envVars: string[];
  phase: number;
  docsHe: string;
  docsEn: string;
  /** Live status from configuration. Never makes claims beyond what can be verified. */
  status: () => Promise<{ status: IntegrationStatus; detail?: string }>;
};

const hasEnv = (...k: string[]) => k.every((v) => Boolean(process.env[v]?.trim()));
const envStatus = (...k: string[]) => async () => ({ status: (hasEnv(...k) ? "CONNECTED" : "NOT_CONFIGURED") as IntegrationStatus });

export const INTEGRATIONS: IntegrationDef[] = [
  {
    provider: "postgres", name: "PostgreSQL", category: "core", envVars: ["DATABASE_URL"], phase: 1,
    docsHe: "מסד הנתונים הראשי.", docsEn: "Primary database.",
    status: async () => {
      try { await db.$queryRaw`SELECT 1`; return { status: "CONNECTED" }; }
      catch (e) { return { status: "ERROR", detail: String(e).slice(0, 200) }; }
    },
  },
  {
    provider: "anthropic", name: "Anthropic Claude (AI agents)", category: "ai", envVars: ["ANTHROPIC_API_KEY"], phase: 1,
    docsHe: "צרו מפתח ב-platform.claude.com והגדירו ANTHROPIC_API_KEY. מפעיל את סוכני ה-AI והתובנות.",
    docsEn: "Create a key at platform.claude.com and set ANTHROPIC_API_KEY. Powers AI agents and insights.",
    status: envStatus("ANTHROPIC_API_KEY"),
  },
  {
    provider: "external-booking", name: "Cali booking app (cali-b5f0e.web.app)", category: "booking", envVars: ["CALI_WEBHOOK_SECRET"], phase: 2,
    docsHe: "לקאלי אין API ציבורי מתועד. מוכן אצלנו: נקודת קליטה חתומה (HMAC) /api/integrations/cali/webhook לסנכרון חי — דורש שספק Cali ישלח אליה אירועים — וייבוא CSV ללא כפילויות. ראו CALI_INTEGRATION.md.",
    docsEn: "Cali has no documented public API. Ready on our side: a signed (HMAC) endpoint /api/integrations/cali/webhook for live sync — requires the Cali vendor to push events — and duplicate-free CSV import. See CALI_INTEGRATION.md.",
    status: async () => {
      const last = await db.syncLog.findFirst({ where: { source: "cali", channel: "webhook" }, orderBy: { createdAt: "desc" } });
      if (!hasEnv("CALI_WEBHOOK_SECRET")) return { status: "REQUIRES_AUTHORIZATION", detail: "Waiting for vendor access — CSV import available" };
      if (!last) return { status: "REQUIRES_AUTHORIZATION", detail: "Endpoint ready — no events received from Cali yet" };
      return { status: last.failed && last.failed === last.received ? "ERROR" : "CONNECTED", detail: `Last sync ${last.createdAt.toISOString()}` };
    },
  },
  {
    provider: "instagram", name: "Instagram (@castel.cutzz)", category: "social", envVars: ["META_ADS_ACCESS_TOKEN"], phase: 4,
    docsHe: "דורש חשבון Instagram Business, אפליקציית Meta והרשאות OAuth מאושרות. פרסום תמיד דרך מרכז האישורים.",
    docsEn: "Requires an Instagram Business account, a Meta app and approved OAuth permissions. Publishing always goes through Approvals.",
    status: async () => ({ status: hasEnv("META_ADS_ACCESS_TOKEN") ? "CONNECTED" : "REQUIRES_AUTHORIZATION" }),
  },
  {
    provider: "meta-ads", name: "Meta Ads", category: "ads", envVars: ["META_ADS_ACCESS_TOKEN"], phase: 4,
    docsHe: "Marketing API של Meta. כל הוצאה כספית מחייבת אישור בעלים.", docsEn: "Meta Marketing API. Any spend requires owner approval.",
    status: envStatus("META_ADS_ACCESS_TOKEN"),
  },
  {
    provider: "google-ads", name: "Google Ads", category: "ads", envVars: ["GOOGLE_ADS_DEVELOPER_TOKEN"], phase: 4,
    docsHe: "Google Ads API דורש developer token ו-OAuth.", docsEn: "Google Ads API requires a developer token and OAuth.",
    status: envStatus("GOOGLE_ADS_DEVELOPER_TOKEN"),
  },
  {
    provider: "whatsapp", name: "WhatsApp Cloud API", category: "communications", envVars: ["WHATSAPP_CLOUD_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], phase: 3,
    docsHe: "WhatsApp Business Platform של Meta. הודעות שיווקיות רק ללקוחות שאישרו, ורק אחרי אישור.", docsEn: "Meta WhatsApp Business Platform. Marketing messages only to opted-in customers, and only after approval.",
    status: envStatus("WHATSAPP_CLOUD_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"),
  },
  {
    provider: "smtp", name: "Email (SMTP)", category: "communications", envVars: ["SMTP_URL"], phase: 3,
    docsHe: "כל ספק SMTP. נדרש לשליחת אימיילים.", docsEn: "Any SMTP provider. Required to send email.",
    status: envStatus("SMTP_URL"),
  },
  {
    provider: "image-gen", name: "OpenAI Images / Replicate (images)", category: "media", envVars: ["OPENAI_API_KEY", "REPLICATE_API_TOKEN + REPLICATE_MODEL_IMAGE"], phase: 3,
    docsHe: "יצירת תמונות בסטודיו הקריאייטיב. מספיק אחד מהשניים.", docsEn: "Image generation in the Creative Studio. Either one is enough.",
    status: async () => ({ status: hasEnv("OPENAI_API_KEY") || (hasEnv("REPLICATE_API_TOKEN") && hasEnv("REPLICATE_MODEL_IMAGE")) ? "CONNECTED" : "NOT_CONFIGURED" }),
  },
  {
    provider: "video-gen", name: "Replicate (video, animation, 3D, image edit)", category: "media", envVars: ["REPLICATE_API_TOKEN", "REPLICATE_MODEL_VIDEO / _ANIMATION / _3D / _IMAGE_EDIT"], phase: 3,
    docsHe: "בוחרים מודל לכל סוג במשתני הסביבה. סוג ללא מודל נשאר ״ממתין להגדרה״.", docsEn: "Choose a model per type via env vars. Types without a model stay \"pending configuration\".",
    status: async () => ({ status: hasEnv("REPLICATE_API_TOKEN") ? (hasEnv("REPLICATE_MODEL_VIDEO") || hasEnv("REPLICATE_MODEL_ANIMATION") || hasEnv("REPLICATE_MODEL_3D") ? "CONNECTED" : "REQUIRES_AUTHORIZATION") : "NOT_CONFIGURED" }),
  },
  {
    provider: "tts", name: "ElevenLabs (voice-over)", category: "media", envVars: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"], phase: 3,
    docsHe: "קריינות בסטודיו. שיבוט קול של הבעלים — רק בהסכמה מפורשת ובדגימות מאושרות (תאום דיגיטלי).", docsEn: "Voice-overs in the studio. Owner voice cloning only with explicit consent and approved samples (Digital Twin).",
    status: envStatus("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"),
  },
];

export async function getIntegrationStatuses(businessId: string) {
  const results = await Promise.all(
    INTEGRATIONS.map(async (i) => {
      const s = await i.status();
      return { ...i, status: undefined, live: s };
    }),
  );
  // persist last-known state for history / alerts
  await Promise.all(
    results.map((r) =>
      db.integration.upsert({
        where: { businessId_provider: { businessId, provider: r.provider } },
        create: { businessId, provider: r.provider, status: r.live.status, lastCheckAt: new Date(), lastError: r.live.status === "ERROR" ? r.live.detail : null },
        update: { status: r.live.status, lastCheckAt: new Date(), lastError: r.live.status === "ERROR" ? r.live.detail : null },
      }),
    ),
  );
  return results;
}
