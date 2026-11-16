type L = { he: string; en: string };
export type ModuleRoadmap = { phase: number; title: L; ready: L[]; next: L[]; requires: L[] };

export const ROADMAP: Record<string, ModuleRoadmap> = {
  marketing: {
    phase: 3,
    title: { he: "מחלקת שיווק AI", en: "AI Marketing Department" },
    ready: [
      { he: "סוכן שיווק וסוכן תוכן פעילים בעמוד סוכני AI (כשמוגדר ANTHROPIC_API_KEY)", en: "Marketing and Content agents live on the AI Agents page (when ANTHROPIC_API_KEY is set)" },
      { he: "מודל Campaign במסד הנתונים (תקציב, ערוץ, סטטוס, תוכנית)", en: "Campaign database model (budget, channel, status, plan)" },
      { he: "מרכז אישורים — כל פרסום/הוצאה כספית מחייבים אישור", en: "Approvals center — every publish/spend requires approval" },
    ],
    next: [
      { he: "מחולל אסטרטגיית קמפיין ולוח תוכן חודשי שנשמרים כרשומות", en: "Campaign strategy generator and monthly content calendar saved as records" },
      { he: "תכנון תקציב ודוחות ביצועים", en: "Budget planning and performance reports" },
      { he: "ניתוח קהלים מתוך נתוני ה-CRM (מצטבר בלבד)", en: "Audience analysis from CRM data (aggregated only)" },
    ],
    requires: [{ he: "Meta Marketing API / Google Ads API לנתוני ביצועים אמיתיים", en: "Meta Marketing API / Google Ads API for real performance data" }],
  },
  creative: {
    phase: 4,
    title: { he: "סטודיו קריאייטיב AI", en: "AI Creative Studio" },
    ready: [{ he: "ארכיטקטורת מתאמי ספקים ומשתני סביבה (IMAGE/VIDEO/TTS)", en: "Provider adapter architecture and env vars (IMAGE/VIDEO/TTS)" }, { he: "סטטוס ספקים בעמוד האינטגרציות", en: "Provider status on the Integrations page" }],
    next: [
      { he: "יצירה ועריכת תמונות, גרפיקות קידום ותבניות מותג", en: "Image generation/editing, promo graphics and brand templates" },
      { he: "תהליכי וידאו, אנימציה, נכסי תלת-ממד וקריינות", en: "Video, animation, 3D asset and voiceover workflows" },
      { he: "ספריית נכסים עם אישור לפני שימוש", en: "Asset library with approval before use" },
    ],
    requires: [{ he: "ספק מדיה תואם עם מפתח API — יכולות יסומנו פעילות רק לאחר חיבור", en: "A compatible media provider with an API key — capabilities are marked active only once connected" }],
  },
  sites: {
    phase: 3,
    title: { he: "בונה אתרים ודפי נחיתה", en: "Website & Landing Page Builder" },
    ready: [
      { he: "דף נחיתה ציבורי פעיל לאקדמיה: /join עם טופס לידים, הסכמה, הגנת ספאם והגבלת קצב", en: "Live public academy landing page: /join with lead form, consent, spam honeypot and rate limiting" },
      { he: "לידים נכנסים למשפך הרישום באקדמיה", en: "Leads flow into the Academy enrollment funnel" },
    ],
    next: [
      { he: "עורך בלוקים לדפי קמפיין, הגדרות SEO, תצוגה מקדימה ופרסום", en: "Block editor for campaign pages, SEO settings, preview & publish" },
      { he: "ארכיטקטורת דומיין מותאם", en: "Custom domain architecture" },
    ],
    requires: [{ he: "הגדרת DNS לדומיין מותאם", en: "DNS configuration for a custom domain" }],
  },
  communications: {
    phase: 3,
    title: { he: "מרכז תקשורת", en: "Communications Center" },
    ready: [
      { he: "היסטוריית תקשורת ללקוח ב-CRM", en: "Per-customer communication history in CRM" },
      { he: "ניהול הסכמה והסרה לכל ערוץ (WhatsApp/SMS/אימייל)", en: "Per-channel consent & opt-out management (WhatsApp/SMS/email)" },
      { he: "טיוטות הודעה (קמפיין ימי הולדת) נשלחות לאישור — לא נשלחות אוטומטית", en: "Message drafts (birthday campaign) go to approval — never auto-sent" },
      { he: "מודל MessageTemplate במסד הנתונים", en: "MessageTemplate database model" },
    ],
    next: [{ he: "תבניות אימייל, תיבת פניות, רצפי מעקב והתראות", en: "Email templates, support inbox, follow-up sequences, notifications" }, { he: "ביצוע הודעות מאושרות דרך ספק מוגדר", en: "Execute approved messages through a configured provider" }],
    requires: [{ he: "WhatsApp Cloud API (Meta) ו/או SMTP", en: "WhatsApp Cloud API (Meta) and/or SMTP" }],
  },
  automations: {
    phase: 3,
    title: { he: "בונה אוטומציות", en: "Automation Builder" },
    ready: [
      { he: "מודלים Automation + AutomationRun (טריגרים, תנאים, פעולות, ניסיונות חוזרים, היסטוריה)", en: "Automation + AutomationRun models (triggers, conditions, actions, retries, history)" },
      { he: "שלב אישור אנושי קיים (ApprovalRequest)", en: "Human approval step exists (ApprovalRequest)" },
      { he: "תהליכים קיימים כקוד: השלמת תור → הכנסה בפועל + עדכון לקוח; תשלום אקדמיה → עסקה", en: "Built-in flows: appointment completed → actual income + customer stats; academy payment → transaction" },
    ],
    next: [{ he: "עורך ויזואלי, מנוע עבודות רקע, טיפול בשגיאות ומדיניות ניסיונות חוזרים", en: "Visual editor, background job engine, error handling & retry policies" }, { he: "סיכום ביצועים שבועי", en: "Weekly performance summary" }],
    requires: [{ he: "תהליך worker (npm run jobs) או cron בסביבת הייצור", en: "A worker process (npm run jobs) or cron in production" }],
  },
  twin: {
    phase: 5,
    title: { he: "תאום דיגיטלי של הבעלים", en: "Owner AI Digital Twin" },
    ready: [{ he: "מודל KnowledgeItem לבסיס ידע מאושר ע״י הבעלים", en: "KnowledgeItem model for an owner-approved knowledge base" }, { he: "סוכני AI עם קול המותג", en: "AI agents with brand voice" }],
    next: [{ he: "עוזר שיחה מאומן על ידע מאושר, יצירת תסריטים, תהליך וידאו עם אישור לפני פרסום", en: "Conversational assistant on approved knowledge, script generation, video workflow with approval before publishing" }],
    requires: [{ he: "הסכמה מפורשת, חומרי מקור מהבעלים (תמונה/קול) וספק אווטאר/קול מוגדר. ללא אלה — אין שיבוט מראה או קול.", en: "Explicit consent, owner-supplied source media (image/voice) and a configured avatar/voice provider. Without these there is no appearance or voice cloning." }],
  },
};
