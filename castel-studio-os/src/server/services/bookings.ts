import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { parseLocalDateTime } from "@/lib/dates";
import { recomputeCustomerStats, DomainError } from "./crm";
import type { AppointmentStatus } from "@prisma/client";
import type { z } from "zod";
import type { appointmentSchema } from "@/lib/validation";
import { toNumber } from "@/lib/utils";

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
      where: { businessId: actor.businessId, staffId: input.staffId, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
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
  return a;
}

const ALLOWED: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW", "SCHEDULED"],
  COMPLETED: ["SCHEDULED"],
  CANCELLED: ["SCHEDULED"],
  NO_SHOW: ["SCHEDULED", "COMPLETED"],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return ALLOWED[from].includes(to);
}

export async function setAppointmentStatus(actor: Actor, id: string, status: AppointmentStatus, reason?: string) {
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
  await audit({ businessId: actor.businessId, userId: actor.id, action: `appointment.${status.toLowerCase()}`, entityType: "Appointment", entityId: id, metadata: reason ? { reason } : undefined });
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
