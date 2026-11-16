import { z } from "zod";
import { normalizeIsraeliPhone } from "@/domain/crm";

const optionalText = (max = 500) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().max(max).optional());

export const phoneField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = normalizeIsraeliPhone(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "crm.invalidPhone" });
        return z.NEVER;
      }
      return n;
    }),
);

const emailField = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().toLowerCase().email().max(200).optional());
const dateField = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional());
const consent = z.enum(["UNKNOWN", "OPTED_IN", "OPTED_OUT"]).default("UNKNOWN");

export const customerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: optionalText(80),
  phone: phoneField,
  email: emailField,
  birthday: dateField,
  source: optionalText(80),
  preferences: optionalText(2000),
  tags: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []),
    z.array(z.string().max(40)).max(20),
  ),
  status: z.enum(["ACTIVE", "AT_RISK", "LAPSED", "VIP", "BLOCKED"]).optional(),
  marketingConsentSms: consent,
  marketingConsentEmail: consent,
  marketingConsentWhatsapp: consent,
});

export const noteSchema = z.object({ body: z.string().trim().min(1).max(4000), pinned: z.coerce.boolean().optional() });

export const interactionSchema = z.object({
  channel: z.enum(["PHONE", "SMS", "WHATSAPP", "EMAIL", "INSTAGRAM", "IN_PERSON", "OTHER"]),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  summary: z.string().trim().min(1).max(2000),
});

export const serviceSchema = z.object({
  nameHe: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  durationMin: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().min(0).max(100000),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const appointmentSchema = z.object({
  customerId: optionalText(40),
  serviceId: optionalText(40),
  staffId: optionalText(40),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  durationMin: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(5).max(600).optional()),
  price: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(100000).optional()),
  notes: optionalText(1000),
});

export const cohortSchema = z.object({
  courseId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  instructorId: optionalText(40),
  status: z.enum(["PLANNED", "OPEN", "FULL", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("OPEN"),
});

export const studentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: optionalText(80),
  phone: phoneField,
  email: emailField,
  experience: optionalText(1000),
  goals: optionalText(1000),
  status: z.enum(["LEAD", "ENROLLED", "ACTIVE", "GRADUATED", "DROPPED"]).default("ENROLLED"),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive().max(100000),
  method: z.enum(["CASH", "CREDIT_CARD", "BANK_TRANSFER", "BIT", "PAYBOX", "OTHER"]),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: optionalText(120),
});

export const leadPublicSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneField,
  email: emailField,
  courseCode: z.string().max(20).optional(),
  message: optionalText(1000),
  consent: z.literal(true),
  // honeypot — must be empty
  website: z.string().max(0).optional(),
});

export const INCOME_CATEGORIES = ["services", "academy", "products", "other_income"] as const;
export const EXPENSE_CATEGORIES = ["rent", "salaries", "supplies", "marketing", "utilities", "software", "other_expense"] as const;

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    kind: z.enum(["ACTUAL", "ESTIMATE"]),
    category: z.enum([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]),
    amount: z.coerce.number().positive().max(10_000_000),
    occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: optionalText(300),
    method: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["CASH", "CREDIT_CARD", "BANK_TRANSFER", "BIT", "PAYBOX", "OTHER"]).optional()),
  })
  .refine((v) => (v.type === "INCOME" ? (INCOME_CATEGORIES as readonly string[]).includes(v.category) : (EXPENSE_CATEGORIES as readonly string[]).includes(v.category)), {
    path: ["category"],
    message: "category mismatch",
  });

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  details: optionalText(2000),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  dueAt: dateField,
  assigneeId: optionalText(40),
});

export const userSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["OWNER", "MANAGER", "BARBER", "INSTRUCTOR", "MARKETING", "ACCOUNTANT", "VIEWER"]),
  password: z.string().min(10).max(200),
});

/** Convert FormData to a plain object; multi-value keys become arrays. */
export function formToObject(fd: FormData, arrayKeys: string[] = []) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (arrayKeys.includes(k)) (o[k] = (o[k] as unknown[] | undefined) ?? []), (o[k] as unknown[]).push(v);
    else o[k] = v;
  }
  for (const k of arrayKeys) o[k] ??= [];
  return o;
}

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string } | null;

export function zodFieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
