import type { Permission } from "@/server/auth/rbac";

export type AgentId = "ceo" | "marketing" | "sales" | "support" | "finance" | "content" | "academy" | "operations";

export type AgentDef = {
  id: AgentId;
  /** Keywords (Hebrew + English, lower-case) used by the deterministic router. */
  keywords: string[];
  /** Data scopes this agent may receive in its context. */
  scopes: ("overview" | "crm" | "bookings" | "academy" | "finance" | "marketing")[];
  /** Extra permission required to use this agent at all. */
  requires?: Permission;
  brief: string;
};

export const AGENTS: Record<AgentId, AgentDef> = {
  ceo: {
    id: "ceo",
    keywords: ["אסטרטגיה", "חזון", "צמיחה", "סניף", "התרחבות", "תוכנית עסקית", "יעדים", "strategy", "growth", "expand", "branch", "vision", "okr", "plan the business"],
    scopes: ["overview", "crm", "bookings", "academy", "finance"],
    brief: "Strategic advisor to the owner: growth, positioning, priorities, multi-branch expansion, trade-offs.",
  },
  marketing: {
    id: "marketing",
    keywords: ["קמפיין", "שיווק", "פרסום", "מודעה", "קהל", "תקציב פרסום", "מטא", "גוגל", "campaign", "marketing", "ads", "audience", "meta", "google ads", "budget", "funnel"],
    scopes: ["overview", "crm", "academy", "marketing"],
    brief: "Marketing strategist: campaigns, audiences, budget allocation, funnels, Meta/Google Ads planning (plans only).",
  },
  content: {
    id: "content",
    keywords: ["פוסט", "אינסטגרם", "טיקטוק", "כיתוב", "האשטאג", "רילס", "סרטון", "לוח תוכן", "תסריט", "caption", "hashtag", "instagram", "tiktok", "reel", "content calendar", "script", "post"],
    scopes: ["overview"],
    brief: "Content creator: Instagram/TikTok ideas, captions, hashtags, reel scripts, monthly content calendars in the CASTEL brand voice.",
  },
  sales: {
    id: "sales",
    keywords: ["מכירה", "המרה", "ליד", "הצעת מחיר", "מבצע", "חבילה", "upsell", "sales", "convert", "lead", "offer", "package", "pricing offer", "close"],
    scopes: ["overview", "academy", "crm"],
    brief: "Sales specialist: lead conversion scripts, offers, packages, upsells, objection handling.",
  },
  support: {
    id: "support",
    keywords: ["לקוח כועס", "תלונה", "שירות לקוחות", "תשובה ללקוח", "ביקורת", "complaint", "support", "reply to customer", "review", "refund"],
    scopes: ["overview"],
    brief: "Customer support: polite, warm draft replies to customers and reviews. Drafts only — never sends.",
  },
  finance: {
    id: "finance",
    keywords: ["כסף", "רווח", "הוצאות", "הכנסות", "תזרים", "מחיר", "תמחור", "תחזית", "מע״מ", "profit", "expense", "revenue", "cash flow", "pricing", "forecast", "margin", "finance"],
    scopes: ["overview", "finance", "bookings", "academy"],
    requires: "ai.financeData",
    brief: "Finance analyst: profitability, pricing, cash flow, scenario analysis. Distinguishes actuals from estimates; not tax advice.",
  },
  academy: {
    id: "academy",
    keywords: ["אקדמיה", "קורס", "תלמיד", "מחזור", "שיעור", "סילבוס", "תעודה", "academy", "course", "student", "cohort", "lesson", "syllabus", "curriculum", "certificate"],
    scopes: ["overview", "academy"],
    brief: "Academy assistant: curriculum, lesson plans, student communication drafts, cohort planning for the Group (5,500 ILS) and VIP (6,500 ILS) courses.",
  },
  operations: {
    id: "operations",
    keywords: ["תפעול", "משמרות", "ספרים", "מלאי", "תורים", "יעילות", "ביטולים", "אי הגעה", "operations", "staff", "schedule", "inventory", "no-show", "cancellation", "efficiency"],
    scopes: ["overview", "bookings"],
    brief: "Operations: scheduling, staffing, no-show reduction, inventory and daily workflows.",
  },
};

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];
