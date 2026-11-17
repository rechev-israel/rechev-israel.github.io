"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { appointmentSchema, formToObject, serviceSchema, type ActionState } from "@/lib/validation";
import { createAppointment, setAppointmentStatus } from "@/server/services/bookings";
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
    if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) return { error: t.errors.validation };
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
