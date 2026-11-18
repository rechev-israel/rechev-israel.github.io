import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { parseLocalDateTime } from "@/lib/dates";
import { recomputeCustomerStats, DomainError } from "./crm";
import type { AppointmentStatus } from "@prisma/client";
import type { z } from "zod";
import type { appointmentSchema } from "@/lib/validation";
import { toNumber } from "@/lib/utils";
import { emitEvent, customerCtx } from "@/server/automation/engine";

type Actor = { id: string; businessId: string };

export async function createAppointment(actor: Actor, input: z.infer<typeof appointmentSchema>, opts: { allowOverlap?: boolean } = {}) {
  const startsAt = parseLocalDateTime(input.startsAt);
  const service = input.serviceId ? await db.service.findFirst({ where: { id: input.serviceId, businessId: actor.businessId } }) : null;
  if (input.serviceId && !service) throw new DomainError("errors.notFound", "serviceId");
  if (input.customerId) {
    const c = await db.customer.findFirst({ where: { id: input.customerId, businessId: actor.businessId } });
    if (!c) throw new DomainError("errors.notFound", "customerId");
  }
  if (input.staffId) {
    const s = await db.user.findFirst({ where: { id: input.staffId, businessId: actor.businessId } });
    if (!s) throw new DomainError("errors.notFound", "staffId");
  }
  const duration = input.durationMin ?? service?.durationMin ?? 30;
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);

  if (input.staffId && !opts.allowOverlap) {
    const overlap = await db.appointment.findFirst({
      where: { businessId: actor.businessId, staffId: input.staffId, status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (overlap) throw new DomainError("bookings.overlap", "startsAt");
  }
  const branch = await db.branch.findFirst({ where: { businessId: actor.businessId, isActive: true }, orderBy: { createdAt: "asc" } });
  const a = await db.appointment.create({
    data: {
      businessId: actor.businessId,
      branchId: branch?.id,
      customerId: input.customerId || null,
      serviceId: service?.id ?? null,
      staffId: input.staffId || null,
      startsAt,
      endsAt,
      price: input.price ?? (service ? toNumber(service.price) : null),
      notes: input.notes ?? null,
    },
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "appointment.create", entityType: "Appointment", entityId: a.id });
  await emitAppointment(actor.businessId, "appointment.created", a.id);
  return a;
}

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW", "SCHEDULED"],
  COMPLETED: ["SCHEDULED", "NO_SHOW"],
  CANCELLED: ["SCHEDULED"],
  NO_SHOW: ["SCHEDULED", "COMPLETED"],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return ALLOWED[from].includes(to);
}

export async function setAppointmentStatus(actor: { id: string | null; businessId: string }, id: string, status: AppointmentStatus, reason?: string) {
  const a = await db.appointment.findFirst({ where: { id, businessId: actor.businessId } });
  if (!a) throw new DomainError("errors.notFound");
  if (!canTransition(a.status, status)) throw new DomainError("errors.validation");
  await db.appointment.update({
    where: { id },
    data: {
      status,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
      cancelReason: status === "CANCELLED" ? reason ?? null : null,
    },
  });
  // Completing an appointment records ACTUAL income once; reverting removes it.
  const marker = `appointment:${id}`;
  if (status === "COMPLETED" && a.price && toNumber(a.price) > 0) {
    const exists = await db.transaction.findFirst({ where: { businessId: actor.businessId, description: marker } });
    if (!exists)
      await db.transaction.create({
        data: { businessId: actor.businessId, type: "INCOME", kind: "ACTUAL", category: "services", amount: a.price, occurredAt: a.startsAt, description: marker, customerId: a.customerId },
      });
  } else if (a.status === "COMPLETED" && status !== "COMPLETED") {
    await db.transaction.deleteMany({ where: { businessId: actor.businessId, description: marker } });
  }
  if (a.customerId) await recomputeCustomerStats(actor.businessId, a.customerId);
  if (status === "COMPLETED") await emitAppointment(actor.businessId, "appointment.completed", id);
  if (status === "NO_SHOW") await emitAppointment(actor.businessId, "appointment.no_show", id);
  await audit({ businessId: actor.businessId, userId: actor.id || null, action: actor.id ? `appointment.${status.toLowerCase()}` : `appointment.auto_${status.toLowerCase()}`, entityType: "Appointment", entityId: id, metadata: reason ? { reason } : undefined });
}

export async function emitAppointment(businessId: string, trigger: "appointment.created" | "appointment.completed" | "appointment.no_show", id: string) {
  const ap = await db.appointment.findUnique({ where: { id }, include: { customer: true, service: true } });
  if (!ap) return;
  await emitEvent(businessId, trigger, {
    appointment: { id: ap.id, startsAt: ap.startsAt, status: ap.status, price: toNumber(ap.price), serviceName: ap.service?.nameHe ?? "" },
    ...(ap.customer ? { customer: customerCtx(ap.customer) } : {}),
  });
}

export async function bookingAnalytics(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db.appointment.groupBy({ by: ["status"], where: { businessId, startsAt: { gte: since, lte: new Date() } }, _count: true, _sum: { price: true } });
  const count = (s: AppointmentStatus) => rows.find((r) => r.status === s)?._count ?? 0;
  const total = rows.reduce((s, r) => s + r._count, 0);
  const completedRevenue = toNumber(rows.find((r) => r.status === "COMPLETED")?._sum.price);
  return {
    total,
    completed: count("COMPLETED"),
    cancelled: count("CANCELLED"),
    noShow: count("NO_SHOW"),
    cancellationRate: total ? Math.round((count("CANCELLED") / total) * 100) : null,
    noShowRate: total ? Math.round((count("NO_SHOW") / total) * 100) : null,
    completedRevenue,
    avgTicket: count("COMPLETED") ? Math.round(completedRevenue / count("COMPLETED")) : null,
  };
}

const OCCUPY: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW"];

/** Move an appointment (and optionally change its length/barber). Refuses overlaps unless explicitly allowed. */
export async function rescheduleAppointment(actor: Actor, id: string, input: { startsAt: string; durationMin?: number; staffId?: string | null }, opts: { allowOverlap?: boolean } = {}) {
  const a = await db.appointment.findFirst({ where: { id, businessId: actor.businessId } });
  if (!a) throw new DomainError("errors.notFound");
  if (a.status === "CANCELLED") throw new DomainError("errors.validation");
  const startsAt = parseLocalDateTime(input.startsAt);
  const duration = input.durationMin ?? Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000);
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const staffId = input.staffId === undefined ? a.staffId : input.staffId || null;
  if (staffId && !(await db.user.findFirst({ where: { id: staffId, businessId: actor.businessId } }))) throw new DomainError("errors.notFound", "staffId");
  if (!opts.allowOverlap) {
    const singleChair = (await db.user.count({ where: { businessId: actor.businessId, isActive: true, acceptsBookings: true } })) <= 1;
    const overlap = await db.appointment.findFirst({
      where: { businessId: actor.businessId, id: { not: id }, status: { in: OCCUPY }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt },
        ...(staffId ? { OR: [{ staffId }, ...(singleChair ? [{ staffId: null }] : [])] } : singleChair ? {} : { staffId: null }) },
    });
    if (overlap) throw new DomainError("bookings.overlap", "startsAt");
  }
  const updated = await db.appointment.update({ where: { id }, data: { startsAt, endsAt, staffId } });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "appointment.reschedule", entityType: "Appointment", entityId: id, metadata: { from: a.startsAt.toISOString(), to: startsAt.toISOString() } });
  if (a.startsAt.getTime() !== startsAt.getTime()) {
    const { notifyAppointmentEvent } = await import("@/server/notify/owner");
    await notifyAppointmentEvent("booking_rescheduled", id, { dedupeSuffix: String(startsAt.getTime()), previousStartsAt: a.startsAt, actorUserId: actor.id });
  }
  return updated;
}

const lastAutoComplete = new Map<string, number>();

/**
 * Appointments whose end time has passed are marked COMPLETED automatically (records the income once, updates the
 * customer's visits). Runs at most once a minute per business; called when the calendar/dashboard load, while the
 * app is open (notification polling) and by the daily cron. A no-show can still be corrected from the calendar.
 */
export async function autoCompletePastAppointments(businessId: string, opts: { force?: boolean } = {}) {
  if (!opts.force && Date.now() - (lastAutoComplete.get(businessId) ?? 0) < 60_000) return 0;
  lastAutoComplete.set(businessId, Date.now());
  const due = await db.appointment.findMany({ where: { businessId, status: { in: ["SCHEDULED", "CONFIRMED"] }, endsAt: { lte: new Date() }, OR: [{ notes: null }, { notes: { not: "[DEMO]" } }] }, select: { id: true }, orderBy: { endsAt: "asc" }, take: 200 });
  let n = 0;
  for (const a of due) {
    try { await setAppointmentStatus({ id: null, businessId }, a.id, "COMPLETED"); n++; } catch { /* already changed concurrently */ }
  }
  return n;
}

/** Demo-seed records (marked [DEMO]) for the owner's "remove demo data" button. */
async function demoWhere(businessId: string) {
  const appts = await db.appointment.findMany({ where: { businessId, notes: "[DEMO]" }, select: { id: true } });
  return {
    apptIds: appts.map((a) => a.id),
    tx: { businessId, OR: [{ description: { startsWith: "[DEMO]" } }, { description: { in: appts.map((a) => `appointment:${a.id}`) } }] },
    customers: { businessId, tags: { has: "DEMO" } },
    services: { businessId, nameEn: { startsWith: "[DEMO]" } },
    leads: { businessId, name: { startsWith: "[DEMO]" } },
  };
}
export async function demoDataCounts(businessId: string) {
  const w = await demoWhere(businessId);
  const [transactions, customers, services, leads] = await Promise.all([db.transaction.count({ where: w.tx }), db.customer.count({ where: w.customers }), db.service.count({ where: w.services }), db.lead.count({ where: w.leads })]);
  return { appointments: w.apptIds.length, transactions, customers, services, leads };
}
export async function purgeDemoData(actor: { id: string; businessId: string }) {
  const w = await demoWhere(actor.businessId);
  const r = await db.$transaction([
    db.notification.deleteMany({ where: { businessId: actor.businessId, entityId: { in: w.apptIds } } }),
    db.transaction.deleteMany({ where: w.tx }),
    db.appointment.deleteMany({ where: { id: { in: w.apptIds } } }),
    db.lead.deleteMany({ where: w.leads }),
    db.customer.deleteMany({ where: w.customers }),
    db.service.deleteMany({ where: { ...w.services, appointments: { none: {} } } }),
  ]);
  await audit({ businessId: actor.businessId, userId: actor.id, action: "demo.purge", entityType: "Business", entityId: actor.businessId, metadata: { notifications: r[0].count, transactions: r[1].count, appointments: r[2].count, leads: r[3].count, customers: r[4].count, services: r[5].count } });
  return { transactions: r[1].count, appointments: r[2].count, leads: r[3].count, customers: r[4].count, services: r[5].count };
}
