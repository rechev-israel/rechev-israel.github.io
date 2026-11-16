"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { appointmentSchema, formToObject, serviceSchema, type ActionState } from "@/lib/validation";
import { createAppointment, setAppointmentStatus } from "@/server/services/bookings";
import { recomputeCustomerStats } from "@/server/services/crm";
import { parseBookingCsv } from "@/server/integrations/external-booking";
import { normalizeIsraeliPhone } from "@/domain/crm";
import { getI18n, fmt } from "@/i18n";
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
    if (!(file instanceof File) || file.size === 0) return { error: t.errors.validation };
    if (file.size > 2_000_000) return { error: t.errors.validation };
    const { rows, errors } = parseBookingCsv(await file.text());
    let imported = 0;
    let skipped = errors.length;
    const services = await db.service.findMany({ where: { businessId: user.businessId } });
    for (const r of rows) {
      const externalRef = `csv:${r.startsAt.toISOString()}:${r.phone ?? r.name}`;
      if (await db.appointment.findFirst({ where: { businessId: user.businessId, externalRef } })) { skipped++; continue; }
      const phone = normalizeIsraeliPhone(r.phone);
      let customer = phone ? await db.customer.findFirst({ where: { businessId: user.businessId, phone } }) : null;
      if (!customer && r.name) {
        const [firstName, ...rest] = r.name.split(/\s+/);
        customer = await db.customer.create({ data: { businessId: user.businessId, firstName, lastName: rest.join(" ") || null, phone, source: "booking-app" } });
      }
      const service = r.service ? services.find((s) => s.nameHe === r.service || s.nameEn.toLowerCase() === r.service!.toLowerCase()) : undefined;
      const duration = service?.durationMin ?? 30;
      const appt = await db.appointment.create({
        data: {
          businessId: user.businessId, customerId: customer?.id, serviceId: service?.id, startsAt: r.startsAt, endsAt: new Date(r.startsAt.getTime() + duration * 60000),
          status: r.status, price: r.price ?? service?.price ?? null, source: "external-import", externalRef,
        },
      });
      if (appt.status === "COMPLETED" && appt.price && Number(appt.price) > 0) {
        await db.transaction.create({
          data: { businessId: user.businessId, type: "INCOME", kind: "ACTUAL", category: "services", amount: appt.price, occurredAt: appt.startsAt, description: `appointment:${appt.id}`, customerId: appt.customerId },
        });
      }
      imported++;
    }
    if (imported) await recomputeCustomerStats(user.businessId);
    await audit({ businessId: user.businessId, userId: user.id, action: "bookings.import_csv", entityType: "Appointment", metadata: { imported, skipped } });
    revalidatePath("/bookings");
    return { ok: true, message: fmt(t.external.imported, { n: imported, s: skipped }) + (errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : "") };
  });
}
