import { z } from "zod";

/** Trigger catalogue. "event" triggers fire from business actions; "schedule" triggers run from the daily scheduler. */
export const TRIGGERS = {
  "customer.created": { kind: "event", he: "לקוח חדש נרשם", en: "New customer registered", subject: "customer" },
  "appointment.created": { kind: "event", he: "תור נקבע", en: "Appointment booked", subject: "appointment" },
  "appointment.completed": { kind: "event", he: "תור הושלם", en: "Appointment completed", subject: "appointment" },
  "appointment.no_show": { kind: "event", he: "לקוח לא הגיע לתור", en: "Appointment no-show", subject: "appointment" },
  "lead.created": { kind: "event", he: "ליד חדש", en: "New lead", subject: "lead" },
  "enrollment.created": { kind: "event", he: "תלמיד נרשם למחזור", en: "Student enrolled", subject: "enrollment" },
  "campaign.submitted": { kind: "event", he: "קמפיין הוגש לאישור", en: "Campaign submitted for approval", subject: "campaign" },
  "schedule.appointment_reminder": { kind: "schedule", he: "יומי: תורים של מחר", en: "Daily: tomorrow's appointments", subject: "appointment" },
  "schedule.birthday": { kind: "schedule", he: "יומי: ימי הולדת היום", en: "Daily: today's birthdays", subject: "customer" },
  "schedule.lead_followup": { kind: "schedule", he: "יומי: לידים שהגיע מועד המעקב", en: "Daily: leads due for follow-up", subject: "lead" },
  "schedule.academy_payment": { kind: "schedule", he: "שבועי (ראשון): יתרות תשלום באקדמיה", en: "Weekly (Sunday): academy balances due", subject: "enrollment" },
  "schedule.weekly_report": { kind: "schedule", he: "שבועי (ראשון): דוח ביצועים", en: "Weekly (Sunday): performance report", subject: "business" },
} as const;
export type TriggerKey = keyof typeof TRIGGERS;
export const TRIGGER_KEYS = Object.keys(TRIGGERS) as TriggerKey[];

export const conditionSchema = z.object({
  field: z.string().regex(/^[a-zA-Z][\w.]{0,60}$/),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "exists", "not_exists", "contains", "in"]),
  value: z.union([z.string().max(200), z.number(), z.boolean(), z.array(z.string().max(100)).max(20)]).optional(),
});

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message.draft"),
    channel: z.enum(["WHATSAPP", "EMAIL"]),
    templateKey: z.string().max(60),
    delayHours: z.number().min(0).max(24 * 30).optional(),
  }),
  z.object({ type: z.literal("task.create"), title: z.string().min(1).max(200), dueInDays: z.number().min(0).max(365).default(1), priority: z.number().int().min(1).max(3).default(2) }),
  z.object({ type: z.literal("notify"), title: z.string().min(1).max(200), body: z.string().max(1000).optional(), level: z.enum(["info", "warn", "success"]).default("info") }),
  z.object({ type: z.literal("customer.tag"), tag: z.string().min(1).max(40) }),
  z.object({ type: z.literal("lead.schedule_followup"), inDays: z.number().min(0).max(90) }),
  z.object({ type: z.literal("approval.request"), title: z.string().min(1).max(200) }),
  z.object({ type: z.literal("report.weekly") }),
]);

export const definitionSchema = z.object({
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1).max(10),
});

export type Condition = z.infer<typeof conditionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Definition = z.infer<typeof definitionSchema>;

function get(ctx: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx);
}

function num(v: unknown) {
  if (v instanceof Date) return v.getTime();
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Pure, deterministic condition evaluation (all conditions must pass). */
export function evaluateConditions(conditions: Condition[], ctx: unknown): { pass: boolean; failed?: Condition } {
  for (const c of conditions) {
    const v = get(ctx, c.field);
    let ok: boolean;
    switch (c.op) {
      case "eq": ok = String(v) === String(c.value); break;
      case "neq": ok = String(v) !== String(c.value); break;
      case "gt": ok = num(v) > num(c.value); break;
      case "gte": ok = num(v) >= num(c.value); break;
      case "lt": ok = num(v) < num(c.value); break;
      case "lte": ok = num(v) <= num(c.value); break;
      case "exists": ok = v !== null && v !== undefined && v !== ""; break;
      case "not_exists": ok = v === null || v === undefined || v === ""; break;
      case "contains": ok = Array.isArray(v) ? v.map(String).includes(String(c.value)) : String(v ?? "").includes(String(c.value)); break;
      case "in": ok = Array.isArray(c.value) && c.value.map(String).includes(String(v)); break;
    }
    if (!ok) return { pass: false, failed: c };
  }
  return { pass: true };
}

/** Exponential backoff for retries: 5 min, 10 min, 20 min, ... capped at 6 hours. */
export function retryDelayMs(attempt: number) {
  return Math.min(5 * 60_000 * 2 ** Math.max(0, attempt - 1), 6 * 3600_000);
}
