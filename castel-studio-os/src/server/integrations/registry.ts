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
    provider: "external-booking", name: "CASTEL booking app (cali-b5f0e.web.app)", category: "booking", envVars: [], phase: 1,
    docsHe: "לא ידוע על API ציבורי. נתמך ייבוא CSV ידני בלבד (תורים ← ייבוא). חיבור ישיר ידרוש ממשק רשמי מספק האפליקציה.",
    docsEn: "No public API known. Manual CSV import only (Bookings → Import). A direct link requires an official interface from the app vendor.",
    status: async () => ({ status: "REQUIRES_AUTHORIZATION", detail: "CSV import only" }),
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
    provider: "image-gen", name: "Image generation provider", category: "media", envVars: ["IMAGE_PROVIDER_API_KEY"], phase: 4,
    docsHe: "מתאם ספק יוגדר בשלב 4. ללא ספק — היכולת אינה פעילה.", docsEn: "Provider adapter in Phase 4. Without a provider the capability is inactive.",
    status: envStatus("IMAGE_PROVIDER_API_KEY"),
  },
  {
    provider: "video-gen", name: "Video / avatar provider", category: "media", envVars: ["VIDEO_PROVIDER_API_KEY"], phase: 4,
    docsHe: "אווטאר ווידאו — רק בהסכמה מפורשת וחומרי מקור מהבעלים.", docsEn: "Avatar & video — only with explicit consent and owner-supplied source media.",
    status: envStatus("VIDEO_PROVIDER_API_KEY"),
  },
  {
    provider: "tts", name: "Text-to-speech / voice", category: "media", envVars: ["TTS_PROVIDER_API_KEY"], phase: 4,
    docsHe: "שיבוט קול רק בהסכמה ובדגימות מאושרות.", docsEn: "Voice cloning only with consent and approved samples.",
    status: envStatus("TTS_PROVIDER_API_KEY"),
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
