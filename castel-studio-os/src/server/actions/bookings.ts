"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { appointmentSchema, formToObject, serviceSchema, type ActionState } from "@/lib/validation";
import { createAppointment, rescheduleAppointment, setAppointmentStatus } from "@/server/services/bookings";
import { z } from "zod";
import { parseLocalDateTime } from "@/lib/dates";
import { toNumber } from "@/lib/utils";
import { csvToCaliEvents } from "@/server/integrations/cali/csv";
import { applyCaliEvents } from "@/server/integrations/cali/sync";
import { getI18n } from "@/i18n";
import { runAction } from "./util";
import type { AppointmentStatus } from "@prisma/client";

export async function createAppointmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let ok = false;
  const res = await runAction(async () => {
    const user = await requireUser("bookings.edit");
    await createAppointment(user, appointmentSchema.parse(formToObject(fd)), { allowOverlap: fd.get("allowOverlap") === "on" });
    ok = true;
  });
  if (ok) {
    revalidatePath("/bookings");
    redirect("/bookings?week=" + String(fd.get("startsAt")).slice(0, 10));
  }
  return res;
}

export async function setAppointmentStatusAction(fd: FormData) {
  const user = await requireUser("bookings.edit");
  const status = String(fd.get("status")) as AppointmentStatus;
  if (!["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) return;
  await setAppointmentStatus(user, String(fd.get("id")), status, fd.get("reason") ? String(fd.get("reason")).slice(0, 300) : undefined);
  revalidatePath("/bookings");
  revalidatePath("/dashboard");
}

export async function saveServiceAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("services.edit");
    const input = serviceSchema.parse(formToObject(fd));
    if (id) {
      const r = await db.service.updateMany({ where: { id, businessId: user.businessId }, data: input });
      if (!r.count) throw new Error("not found");
    } else {
      await db.service.create({ data: { ...input, businessId: user.businessId } });
    }
    await audit({ businessId: user.businessId, userId: user.id, action: id ? "service.update" : "service.create", entityType: "Service", entityId: id });
    revalidatePath("/bookings/services");
  });
}

export async function importBookingCsvAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("bookings.edit");
    const { t } = await getI18n();
    const file = fd.get("file");
    const heUi = t.common.saved !== "Saved";
    if (!(file instanceof File) || file.size === 0) return { error: heUi ? "לא נבחר קובץ. לחצו על ״בחירת קובץ״ ובחרו קובץ CSV של תורים." : "No file selected. Tap \"Choose file\" and pick a CSV of appointments.", fieldErrors: { file: "✕" } };
    if (file.size > 5_000_000) return { error: heUi ? "הקובץ גדול מ-5MB." : "File is larger than 5MB.", fieldErrors: { file: "✕" } };
    const { events, errors } = csvToCaliEvents(await file.text());
    if (!events.length) return { error: `${t.errors.validation}${errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : ""}` };
    const r = await applyCaliEvents(user.businessId, events, "csv");
    await audit({ businessId: user.businessId, userId: user.id, action: "bookings.import_csv", entityType: "Appointment", metadata: { created: r.created, updated: r.updated, unchanged: r.unchanged, failed: r.failed + errors.length } });
    revalidatePath("/bookings");
    revalidatePath("/bookings/import");
    const he = t.common.save === "שמירה";
    return {
      ok: true,
      message: he
        ? `נקלטו ${r.received} שורות: ${r.created} חדשים, ${r.updated} עודכנו, ${r.unchanged} ללא שינוי (ללא כפילויות), ${r.failed + errors.length} שגויות.`
        : `Processed ${r.received} rows: ${r.created} new, ${r.updated} updated, ${r.unchanged} unchanged (no duplicates), ${r.failed + errors.length} invalid.`,
    };
  });
}

const revalidateCalendar = () => { revalidatePath("/bookings"); revalidatePath("/dashboard"); };

export async function rescheduleAppointmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("bookings.edit");
    const d = z.object({ id: z.string().min(1), startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/), durationMin: z.coerce.number().int().min(5).max(600).optional(), staffId: z.string().optional() }).parse(formToObject(fd));
    await rescheduleAppointment(user, d.id, { startsAt: d.startsAt, durationMin: d.durationMin, staffId: d.staffId === undefined ? undefined : d.staffId || null }, { allowOverlap: fd.get("allowOverlap") === "on" });
    revalidateCalendar();
  });
}

export async function updateAppointmentDetailsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("bookings.edit");
    const d = z.object({ id: z.string().min(1), serviceId: z.string().optional(), price: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(100000).optional()), notes: z.string().trim().max(1000).optional() }).parse(formToObject(fd));
    const a = await db.appointment.findFirst({ where: { id: d.id, businessId: user.businessId } });
    if (!a) throw new Error("not found");
    const service = d.serviceId ? await db.service.findFirst({ where: { id: d.serviceId, businessId: user.businessId } }) : null;
    await db.appointment.update({ where: { id: a.id }, data: {
      serviceId: d.serviceId === "" ? null : service?.id ?? a.serviceId,
      price: d.price ?? (service && service.id !== a.serviceId ? toNumber(service.price) : a.price),
      notes: d.notes ?? a.notes,
    } });
    await audit({ businessId: user.businessId, userId: user.id, action: "appointment.update", entityType: "Appointment", entityId: a.id });
    revalidateCalendar();
  });
}

export async function setPaymentStatusAction(fd: FormData) {
  const user = await requireUser("bookings.edit");
  const status = String(fd.get("paymentStatus"));
  if (status !== "PAID" && status !== "UNPAID") return;
  await db.appointment.updateMany({ where: { id: String(fd.get("id")), businessId: user.businessId }, data: { paymentStatus: status } });
  await audit({ businessId: user.businessId, userId: user.id, action: `appointment.payment_${status.toLowerCase()}`, entityType: "Appointment", entityId: String(fd.get("id")) });
  revalidateCalendar();
}

export async function blockTimeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("bookings.edit");
    const d = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), minutes: z.coerce.number().int().min(5).max(24 * 60), staffId: z.string().optional(), reason: z.string().trim().max(120).optional() }).parse(formToObject(fd));
    const startsAt = parseLocalDateTime(d.from);
    if (d.staffId && !(await db.user.findFirst({ where: { id: d.staffId, businessId: user.businessId } }))) throw new Error("bad staff");
    await db.timeOff.create({ data: { businessId: user.businessId, staffId: d.staffId || null, startsAt, endsAt: new Date(startsAt.getTime() + d.minutes * 60_000), reason: d.reason || null } });
    await audit({ businessId: user.businessId, userId: user.id, action: "timeoff.create", entityType: "TimeOff" });
    revalidateCalendar();
  });
}

export async function removeBlockAction(fd: FormData) {
  const user = await requireUser("bookings.edit");
  await db.timeOff.deleteMany({ where: { id: String(fd.get("id")), businessId: user.businessId } });
  revalidateCalendar();
}
