"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { emitEvent } from "@/server/automation/engine";
import { createCustomer } from "@/server/services/crm";
import { formToObject, phoneField, type ActionState } from "@/lib/validation";
import { runAction } from "./util";

const opt = (max: number) => z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().max(max).optional());

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneField,
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().email().optional()),
  kind: z.enum(["barbershop", "academy"]),
  courseId: opt(40),
  source: opt(80),
  message: opt(1000),
  consent: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  nextFollowUpAt: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export async function createLeadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("crm.edit");
    const i = leadSchema.parse(formToObject(fd));
    if (!i.phone && !i.email) return { error: "—", fieldErrors: { phone: "required" } };
    const course = i.courseId ? await db.course.findFirst({ where: { id: i.courseId, businessId: user.businessId } }) : null;
    const lead = await db.lead.create({
      data: {
        businessId: user.businessId, name: i.name, phone: i.phone ?? null, email: i.email ?? null, kind: i.kind, courseId: course?.id ?? null,
        source: i.source ?? "manual", message: i.message ?? null, consent: i.consent, nextFollowUpAt: i.nextFollowUpAt ? new Date(i.nextFollowUpAt + "T07:00:00Z") : null,
      },
    });
    await audit({ businessId: user.businessId, userId: user.id, action: "lead.create", entityType: "Lead", entityId: lead.id });
    await emitEvent(user.businessId, "lead.created", { lead: { id: lead.id, name: lead.name, status: lead.status, kind: lead.kind, source: lead.source, courseName: course?.nameHe ?? null } });
    revalidatePath("/crm/leads");
  });
}

export async function updateLeadAction(fd: FormData) {
  const user = await requireUser("crm.edit");
  const id = String(fd.get("id"));
  const data: Record<string, unknown> = {};
  const status = fd.get("status");
  if (status) data.status = z.enum(["NEW", "CONTACTED", "QUALIFIED", "ENROLLED", "LOST"]).parse(status);
  if (fd.has("nextFollowUpAt")) {
    const d = String(fd.get("nextFollowUpAt") ?? "");
    data.nextFollowUpAt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T07:00:00Z") : null;
  }
  if (fd.has("lostReason")) data.lostReason = String(fd.get("lostReason") ?? "").slice(0, 200) || null;
  const r = await db.lead.updateMany({ where: { id, businessId: user.businessId }, data });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "lead.update", entityType: "Lead", entityId: id, metadata: JSON.parse(JSON.stringify(data)) });
  revalidatePath("/crm/leads");
  revalidatePath("/academy/leads");
}

/** Barbershop lead → customer (keeps consent as "unknown" unless the lead explicitly agreed to be contacted). */
export async function convertLeadToCustomerAction(fd: FormData) {
  const user = await requireUser("crm.edit");
  const lead = await db.lead.findFirst({ where: { id: String(fd.get("id")), businessId: user.businessId } });
  if (!lead) return;
  const existing = lead.phone ? await db.customer.findFirst({ where: { businessId: user.businessId, phone: lead.phone } }) : null;
  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const customer = existing ?? (await createCustomer(user, {
    firstName, lastName: rest.join(" ") || undefined, phone: lead.phone ?? undefined, email: lead.email ?? undefined, source: lead.source ?? "lead",
    preferences: lead.message ?? undefined, tags: [], marketingConsentSms: "UNKNOWN", marketingConsentEmail: "UNKNOWN", marketingConsentWhatsapp: "UNKNOWN",
  }));
  await db.lead.update({ where: { id: lead.id }, data: { status: "ENROLLED" } });
  await audit({ businessId: user.businessId, userId: user.id, action: "lead.convert_customer", entityType: "Lead", entityId: lead.id, metadata: { customerId: customer.id } });
  redirect(`/crm/${customer.id}`);
}
