/**
 * Cali → CASTEL STUDIO OS synchronisation core.
 *
 * Source-agnostic: every channel (signed webhook from the vendor, CSV export, future calendar sync) is converted to
 * the same normalised events and applied here. Guarantees:
 *  - Idempotent: appointments are keyed by (businessId, source="cali", externalRef) — a unique DB index — so replays
 *    and repeated imports never create duplicates.
 *  - Customers are matched by Cali customer id, then by normalised phone, then created.
 *  - Revenue: an appointment that becomes COMPLETED posts ONE actual income transaction (same marker as manual
 *    bookings); leaving COMPLETED removes it. Cancellations are reflected, never deleted.
 *  - Never writes back to Cali (read-only sync).
 */
import { z } from "zod";
import { Prisma, type AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeIsraeliPhone } from "@/domain/crm";
import { recomputeCustomerStats } from "@/server/services/crm";

export const SOURCE = "cali";

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "invalid date");

export const caliCustomerSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(160),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
});

export const caliAppointmentSchema = z.object({
  id: z.string().min(1).max(128),
  startsAt: isoDate,
  endsAt: isoDate.optional().nullable(),
  durationMin: z.number().int().min(5).max(600).optional().nullable(),
  status: z.string().max(40).optional().nullable(),
  price: z.number().min(0).max(100000).optional().nullable(),
  service: z.object({ id: z.string().max(128).optional().nullable(), name: z.string().max(160) }).optional().nullable(),
  staffName: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  customer: caliCustomerSchema.optional().nullable(),
  updatedAt: isoDate.optional().nullable(),
});

export const caliEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("appointment.upsert"), data: caliAppointmentSchema }),
  z.object({ type: z.literal("appointment.cancelled"), data: z.object({ id: z.string().min(1).max(128), reason: z.string().max(300).optional().nullable() }) }),
  z.object({ type: z.literal("customer.upsert"), data: caliCustomerSchema.extend({ id: z.string().min(1).max(128) }) }),
]);
export const caliBatchSchema = z.object({ events: z.array(caliEventSchema).min(1).max(500) });

export type CaliEvent = z.infer<typeof caliEventSchema>;
export type CaliAppointment = z.infer<typeof caliAppointmentSchema>;

const STATUS_MAP: Record<string, AppointmentStatus> = {
  scheduled: "SCHEDULED", booked: "SCHEDULED", pending: "SCHEDULED", new: "SCHEDULED", "נקבע": "SCHEDULED",
  confirmed: "CONFIRMED", approved: "CONFIRMED", "אושר": "CONFIRMED",
  completed: "COMPLETED", done: "COMPLETED", finished: "COMPLETED", "הושלם": "COMPLETED",
  cancelled: "CANCELLED", canceled: "CANCELLED", deleted: "CANCELLED", "בוטל": "CANCELLED",
  no_show: "NO_SHOW", "no-show": "NO_SHOW", noshow: "NO_SHOW", "לא הגיע": "NO_SHOW",
};

/** Map a vendor status to ours. Unknown → past appointments COMPLETED, future SCHEDULED. */
export function mapStatus(raw: string | null | undefined, startsAt: Date, now = new Date()): AppointmentStatus {
  const k = (raw ?? "").trim().toLowerCase();
  return STATUS_MAP[k] ?? (startsAt < now ? "COMPLETED" : "SCHEDULED");
}

export type SyncCounters = { received: number; created: number; updated: number; unchanged: number; failed: number; errors: { ref?: string; error: string }[] };
const emptyCounters = (): SyncCounters => ({ received: 0, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] });

async function upsertCustomer(businessId: string, c: z.infer<typeof caliCustomerSchema>) {
  const phone = normalizeIsraeliPhone(c.phone ?? null);
  const [firstName, ...rest] = c.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || null;
  let customer =
    (c.id ? await db.customer.findFirst({ where: { businessId, externalRef: `${SOURCE}:${c.id}` } }) : null) ??
    (phone ? await db.customer.findFirst({ where: { businessId, phone } }) : null);
  if (customer) {
    const patch: Prisma.CustomerUpdateInput = {};
    if (c.id && customer.externalRef !== `${SOURCE}:${c.id}` && !customer.externalRef) patch.externalRef = `${SOURCE}:${c.id}`;
    if (!customer.phone && phone) patch.phone = phone;
    if (!customer.email && c.email) patch.email = c.email.toLowerCase();
    if (Object.keys(patch).length) customer = await db.customer.update({ where: { id: customer.id }, data: patch });
    return { customer, created: false };
  }
  try {
    customer = await db.customer.create({
      data: { businessId, firstName, lastName, phone, email: c.email?.toLowerCase() ?? null, source: "booking-app", externalRef: c.id ? `${SOURCE}:${c.id}` : null },
    });
    return { customer, created: true };
  } catch (e) {
    // Concurrent creation with the same phone → use the existing record.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && phone) {
      return { customer: (await db.customer.findFirstOrThrow({ where: { businessId, phone } })), created: false };
    }
    throw e;
  }
}

async function resolveService(businessId: string, s: CaliAppointment["service"]) {
  if (!s?.name) return null;
  const byRef = s.id ? await db.service.findFirst({ where: { businessId, externalRef: `${SOURCE}:${s.id}` } }) : null;
  if (byRef) return byRef;
  const name = s.name.trim();
  const byName = await db.service.findFirst({ where: { businessId, OR: [{ nameHe: name }, { nameEn: { equals: name, mode: "insensitive" } }] } });
  if (byName && s.id && !byName.externalRef) return db.service.update({ where: { id: byName.id }, data: { externalRef: `${SOURCE}:${s.id}` } });
  return byName; // Unknown services are not auto-created (prices are owned by the business); name is kept in notes.
}

/** Keep the single income record in step with COMPLETED status (idempotent). */
async function syncRevenue(businessId: string, appt: { id: string; status: AppointmentStatus; price: Prisma.Decimal | null; startsAt: Date; customerId: string | null }) {
  const marker = `appointment:${appt.id}`;
  const existing = await db.transaction.findFirst({ where: { businessId, description: marker } });
  const shouldHave = appt.status === "COMPLETED" && appt.price !== null && Number(appt.price) > 0;
  if (shouldHave && !existing) {
    await db.transaction.create({ data: { businessId, type: "INCOME", kind: "ACTUAL", category: "services", amount: appt.price!, occurredAt: appt.startsAt, description: marker, customerId: appt.customerId } });
  } else if (shouldHave && existing && (Number(existing.amount) !== Number(appt.price) || existing.occurredAt.getTime() !== appt.startsAt.getTime())) {
    await db.transaction.update({ where: { id: existing.id }, data: { amount: appt.price!, occurredAt: appt.startsAt } });
  } else if (!shouldHave && existing) {
    await db.transaction.delete({ where: { id: existing.id } });
  }
}

export async function applyAppointment(businessId: string, a: CaliAppointment, counters: SyncCounters, now = new Date()) {
  const startsAt = new Date(a.startsAt);
  const service = await resolveService(businessId, a.service);
  const duration = a.durationMin ?? service?.durationMin ?? 30;
  const endsAt = a.endsAt ? new Date(a.endsAt) : new Date(startsAt.getTime() + duration * 60_000);
  const status = mapStatus(a.status, startsAt, now);
  const customer = a.customer ? (await upsertCustomer(businessId, a.customer)).customer : null;
  const price = a.price ?? (service ? Number(service.price) : null);
  const noteParts = [a.notes, !service && a.service?.name ? `Cali: ${a.service.name}` : null, a.staffName ? `ספר: ${a.staffName}` : null].filter(Boolean);
  const data = {
    customerId: customer?.id ?? null,
    serviceId: service?.id ?? null,
    startsAt,
    endsAt,
    status,
    price: price === null ? null : new Prisma.Decimal(price),
    notes: noteParts.length ? noteParts.join(" · ").slice(0, 1000) : null,
    cancelledAt: status === "CANCELLED" ? now : null,
  };
  const key = { businessId_source_externalRef: { businessId, source: SOURCE, externalRef: a.id } };
  const existing = await db.appointment.findUnique({ where: key });
  let appt;
  if (!existing) {
    const branch = await db.branch.findFirst({ where: { businessId }, orderBy: { createdAt: "asc" } });
    try {
      appt = await db.appointment.create({ data: { ...data, businessId, branchId: branch?.id, source: SOURCE, externalRef: a.id, externalSyncedAt: now } });
      counters.created++;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      appt = await db.appointment.update({ where: key, data: { ...data, externalSyncedAt: now } }); // raced with a parallel delivery
      counters.updated++;
    }
  } else {
    const same =
      existing.status === data.status && existing.startsAt.getTime() === startsAt.getTime() && existing.endsAt.getTime() === endsAt.getTime() &&
      existing.customerId === data.customerId && existing.serviceId === data.serviceId && String(existing.price ?? "") === String(data.price ?? "") && (existing.notes ?? null) === data.notes;
    if (same) {
      counters.unchanged++;
      appt = existing;
    } else {
      appt = await db.appointment.update({ where: key, data: { ...data, cancelledAt: data.status === "CANCELLED" ? existing.cancelledAt ?? now : null, externalSyncedAt: now } });
      counters.updated++;
    }
  }
  await syncRevenue(businessId, appt);
  return appt;
}

export async function applyCancellation(businessId: string, id: string, reason: string | null | undefined, counters: SyncCounters, now = new Date()) {
  const key = { businessId_source_externalRef: { businessId, source: SOURCE, externalRef: id } };
  const existing = await db.appointment.findUnique({ where: key });
  if (!existing) { counters.unchanged++; return null; }
  if (existing.status === "CANCELLED") { counters.unchanged++; return existing; }
  const appt = await db.appointment.update({ where: key, data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason ?? "Cancelled in Cali", externalSyncedAt: now } });
  counters.updated++;
  await syncRevenue(businessId, appt);
  return appt;
}

/** Apply a batch of normalised events and record a SyncLog. Each event is isolated: one bad event never blocks the rest. */
export async function applyCaliEvents(businessId: string, events: CaliEvent[], channel: "webhook" | "csv" | "calendar", now = new Date()) {
  const counters = emptyCounters();
  const touchedCustomers = new Set<string>();
  for (const rawEvent of events) {
    counters.received++;
    try {
      // Validate every event here too, so the guarantees hold for every channel (webhook, CSV, calendar).
      const ev = caliEventSchema.parse(rawEvent);
      if (ev.type === "appointment.upsert") {
        const a = await applyAppointment(businessId, ev.data, counters, now);
        if (a.customerId) touchedCustomers.add(a.customerId);
      } else if (ev.type === "appointment.cancelled") {
        const a = await applyCancellation(businessId, ev.data.id, ev.data.reason, counters, now);
        if (a?.customerId) touchedCustomers.add(a.customerId);
      } else {
        const r = await upsertCustomer(businessId, ev.data);
        if (r.created) counters.created++; else counters.unchanged++;
      }
    } catch (e) {
      counters.failed++;
      const d = (rawEvent as { data?: { id?: unknown } }).data;
      const ref = d && d.id !== undefined ? String(d.id) : undefined;
      if (counters.errors.length < 50) counters.errors.push({ ref, error: String(e).slice(0, 300) });
      logger.warn("cali.sync_event_failed", { ref, err: String(e) });
    }
  }
  for (const id of touchedCustomers) await recomputeCustomerStats(businessId, id);
  await db.syncLog.create({
    data: { businessId, source: SOURCE, channel, received: counters.received, created: counters.created, updated: counters.updated, unchanged: counters.unchanged, failed: counters.failed, errors: counters.errors.length ? counters.errors : undefined },
  });
  return counters;
}
