import { Prisma, type CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { computeSegment } from "@/domain/crm";
import { toNumber } from "@/lib/utils";
import type { z } from "zod";
import type { customerSchema } from "@/lib/validation";

type CustomerInput = z.infer<typeof customerSchema>;
type Actor = { id: string; businessId: string };

export class DomainError extends Error {
  constructor(public code: string, public field?: string) {
    super(code);
  }
}

function toData(input: CustomerInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    birthday: input.birthday ? new Date(input.birthday + "T00:00:00Z") : null,
    source: input.source ?? null,
    preferences: input.preferences ?? null,
    tags: input.tags,
    marketingConsentSms: input.marketingConsentSms,
    marketingConsentEmail: input.marketingConsentEmail,
    marketingConsentWhatsapp: input.marketingConsentWhatsapp,
  };
}

export async function createCustomer(actor: Actor, input: CustomerInput) {
  try {
    const c = await db.customer.create({
      data: { businessId: actor.businessId, ...toData(input), status: input.status === "BLOCKED" ? "BLOCKED" : "ACTIVE", consentUpdatedAt: new Date() },
    });
    await audit({ businessId: actor.businessId, userId: actor.id, action: "customer.create", entityType: "Customer", entityId: c.id });
    return c;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new DomainError("crm.duplicatePhone", "phone");
    throw e;
  }
}

export async function updateCustomer(actor: Actor, id: string, input: CustomerInput) {
  const existing = await db.customer.findFirst({ where: { id, businessId: actor.businessId } });
  if (!existing) throw new DomainError("errors.notFound");
  const data = toData(input);
  const consentChanged =
    existing.marketingConsentSms !== data.marketingConsentSms ||
    existing.marketingConsentEmail !== data.marketingConsentEmail ||
    existing.marketingConsentWhatsapp !== data.marketingConsentWhatsapp;
  try {
    const c = await db.customer.update({
      where: { id },
      data: {
        ...data,
        ...(input.status ? { status: input.status } : {}),
        ...(consentChanged ? { consentUpdatedAt: new Date() } : {}),
      },
    });
    await audit({
      businessId: actor.businessId, userId: actor.id, action: "customer.update", entityType: "Customer", entityId: id,
      metadata: consentChanged ? { consent: { sms: data.marketingConsentSms, email: data.marketingConsentEmail, whatsapp: data.marketingConsentWhatsapp } } : undefined,
    });
    return c;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new DomainError("crm.duplicatePhone", "phone");
    throw e;
  }
}

export async function archiveCustomer(actor: Actor, id: string) {
  const r = await db.customer.updateMany({ where: { id, businessId: actor.businessId }, data: { archivedAt: new Date() } });
  if (r.count) await audit({ businessId: actor.businessId, userId: actor.id, action: "customer.archive", entityType: "Customer", entityId: id });
  return r.count > 0;
}

export async function listCustomers(businessId: string, opts: { q?: string; segment?: string; page?: number; pageSize?: number; sort?: string }) {
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.CustomerWhereInput = { businessId, archivedAt: null };
  if (opts.segment && ["ACTIVE", "AT_RISK", "LAPSED", "VIP", "BLOCKED"].includes(opts.segment)) where.status = opts.segment as CustomerStatus;
  if (opts.q) {
    const q = opts.q.trim();
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
    ];
  }
  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    opts.sort === "spent" ? { totalSpent: "desc" } : opts.sort === "lastVisit" ? { lastVisitAt: { sort: "desc", nulls: "last" } } : opts.sort === "name" ? { firstName: "asc" } : { createdAt: "desc" };
  const [items, total] = await Promise.all([
    db.customer.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    db.customer.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Recompute visit stats from completed appointments, then derive segments. */
export async function recomputeCustomerStats(businessId: string, customerId?: string) {
  const customers = await db.customer.findMany({ where: { businessId, archivedAt: null, ...(customerId ? { id: customerId } : {}) } });
  let changed = 0;
  for (const c of customers) {
    const agg = await db.appointment.aggregate({
      where: { customerId: c.id, status: "COMPLETED" },
      _count: true,
      _max: { startsAt: true },
      _sum: { price: true },
    });
    const visitCount = agg._count;
    const lastVisitAt = agg._max.startsAt ?? c.lastVisitAt;
    const totalSpent = toNumber(agg._sum.price);
    const status = computeSegment({ status: c.status, lastVisitAt, visitCount, totalSpent });
    if (status !== c.status || visitCount !== c.visitCount || totalSpent !== toNumber(c.totalSpent) || lastVisitAt?.getTime() !== c.lastVisitAt?.getTime()) {
      await db.customer.update({ where: { id: c.id }, data: { status, visitCount, totalSpent, lastVisitAt } });
      changed++;
    }
  }
  return changed;
}
