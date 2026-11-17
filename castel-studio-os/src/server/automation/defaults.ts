import type { PrismaClient } from "@prisma/client";
import type { Definition, TriggerKey } from "./definition";

type Builtin = { key: string; name: string; description: string; trigger: TriggerKey; definition: Definition; isActive: boolean };

/**
 * Built-in workflows. They only create drafts, tasks, notifications and approval requests —
 * every outbound message still waits for owner approval in the Communications center.
 */
export const BUILTIN_AUTOMATIONS: Builtin[] = [
  {
    key: "new_customer",
    name: "לקוח חדש — קבלת פנים",
    description: "בעת רישום לקוח חדש: משימת היכרות + טיוטת הודעת ברוכים הבאים ב-WhatsApp (לאישור).",
    trigger: "customer.created",
    isActive: true,
    definition: {
      conditions: [],
      actions: [
        { type: "task.create", title: "היכרות עם לקוח חדש", dueInDays: 0, priority: 2 },
        { type: "message.draft", channel: "WHATSAPP", templateKey: "welcome" },
      ],
    },
  },
  {
    key: "appointment_reminder",
    name: "תזכורת לתור",
    description: "כל בוקר: טיוטת תזכורת WhatsApp לכל תור של מחר (לאישור).",
    trigger: "schedule.appointment_reminder",
    isActive: true,
    definition: { conditions: [], actions: [{ type: "message.draft", channel: "WHATSAPP", templateKey: "appointment_reminder" }] },
  },
  {
    key: "post_visit",
    name: "מעקב אחרי ביקור",
    description: "כשתור מסומן כהושלם: טיוטת הודעת תודה ובקשת ביקורת, לשליחה 3 שעות אחרי (לאישור).",
    trigger: "appointment.completed",
    isActive: true,
    definition: { conditions: [], actions: [{ type: "message.draft", channel: "WHATSAPP", templateKey: "post_visit", delayHours: 3 }] },
  },
  {
    key: "no_show",
    name: "טיפול באי-הגעה",
    description: "כשלקוח לא הגיע: משימה ליצירת קשר ותיוג הלקוח.",
    trigger: "appointment.no_show",
    isActive: true,
    definition: {
      conditions: [],
      actions: [
        { type: "task.create", title: "ליצור קשר עם לקוח שלא הגיע", dueInDays: 0, priority: 2 },
        { type: "customer.tag", tag: "no-show" },
      ],
    },
  },
  {
    key: "academy_lead",
    name: "ליד אקדמיה — מענה מהיר",
    description: "ליד חדש לאקדמיה: טיוטת מענה WhatsApp, משימת שיחה בעדיפות גבוהה ומועד מעקב בעוד יומיים.",
    trigger: "lead.created",
    isActive: true,
    definition: {
      conditions: [{ field: "lead.kind", op: "eq", value: "academy" }],
      actions: [
        { type: "message.draft", channel: "WHATSAPP", templateKey: "academy_lead" },
        { type: "task.create", title: "להתקשר לליד אקדמיה", dueInDays: 0, priority: 1 },
        { type: "lead.schedule_followup", inDays: 2 },
      ],
    },
  },
  {
    key: "lead_followup",
    name: "מעקב לידים",
    description: "כל בוקר: משימה לכל ליד פתוח שהגיע מועד המעקב שלו, וקביעת מעקב הבא בעוד 3 ימים.",
    trigger: "schedule.lead_followup",
    isActive: true,
    definition: {
      conditions: [],
      actions: [
        { type: "task.create", title: "מעקב ליד", dueInDays: 0, priority: 1 },
        { type: "lead.schedule_followup", inDays: 3 },
      ],
    },
  },
  {
    key: "birthday",
    name: "ברכת יום הולדת",
    description: "כל בוקר: טיוטת ברכה ללקוחות שחוגגים היום. נשלחת רק ללקוחות שאישרו דיוור (שיווקי).",
    trigger: "schedule.birthday",
    isActive: true,
    definition: { conditions: [], actions: [{ type: "message.draft", channel: "WHATSAPP", templateKey: "birthday" }] },
  },
  {
    key: "academy_payment",
    name: "תזכורת תשלום — אקדמיה",
    description: "כל יום ראשון: טיוטת תזכורת לתלמידים עם יתרה פתוחה (מחזור שמתחיל השבוע או רץ), ומשימת מעקב תשלום.",
    trigger: "schedule.academy_payment",
    isActive: true,
    definition: {
      conditions: [],
      actions: [
        { type: "message.draft", channel: "WHATSAPP", templateKey: "academy_payment" },
        { type: "task.create", title: "מעקב תשלום אקדמיה", dueInDays: 1, priority: 1 },
      ],
    },
  },
  {
    key: "loyalty_milestone",
    name: "אבן דרך נאמנות",
    description: "כשלקוח משלים ביקור מספר 5/10/20/30/50: תיוג, משימה להכנת הפתעה קטנה והתראה.",
    trigger: "appointment.completed",
    isActive: true,
    definition: {
      conditions: [{ field: "customer.visitCount", op: "in", value: ["5", "10", "20", "30", "50", "75", "100"] }],
      actions: [
        { type: "customer.tag", tag: "milestone" },
        { type: "task.create", title: "אבן דרך — להכין הפתעה ללקוח", dueInDays: 0, priority: 2 },
        { type: "notify", title: "לקוח הגיע לאבן דרך בביקורים", level: "success" },
      ],
    },
  },
  {
    key: "weekly_report",
    name: "דוח ביצועים שבועי",
    description: "כל יום ראשון: סיכום הכנסות, הוצאות, תורים, לקוחות ולידים של השבוע כהתראה.",
    trigger: "schedule.weekly_report",
    isActive: true,
    definition: { conditions: [], actions: [{ type: "report.weekly" }] },
  },
  {
    key: "campaign_approval",
    name: "אישור קמפיין",
    description: "קמפיין שהוגש: בקשת אישור במרכז האישורים והתראה לבעלים.",
    trigger: "campaign.submitted",
    isActive: true,
    definition: {
      conditions: [],
      actions: [
        { type: "approval.request", title: "אישור קמפיין לפרסום" },
        { type: "notify", title: "קמפיין ממתין לאישורך", level: "info" },
      ],
    },
  },
];

/** Install missing built-ins. Never modifies workflows that already exist (the owner may have edited them). */
export async function ensureBuiltinAutomations(db: PrismaClient, businessId: string) {
  let created = 0;
  for (const b of BUILTIN_AUTOMATIONS) {
    const exists = await db.automation.findUnique({ where: { businessId_key: { businessId, key: b.key } } });
    if (exists) continue;
    await db.automation.create({ data: { businessId, key: b.key, name: b.name, description: b.description, trigger: b.trigger, definition: b.definition, isActive: b.isActive } });
    created++;
  }
  return created;
}
