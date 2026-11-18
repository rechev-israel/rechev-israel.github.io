import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { zonedParts } from "@/lib/dates";
import { toNumber } from "@/lib/utils";
import { canCustomerCancel } from "@/domain/booking";
import { normalizeIsraeliPhone } from "@/domain/crm";
import { loyaltyTier, nextMilestone } from "@/domain/loyalty";
import { notifyAppointmentEvent } from "@/server/notify/owner";
import { recomputeCustomerStats } from "./crm";
import { getBookingSettings, hashManageToken } from "./online-booking";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{30,64}$/.test(t);
const pad = (n: number) => String(n).padStart(2, "0");

/** Issue a device key for a customer, or keep the device's existing key when it already belongs to them. */
export async function ensureDevice(customerId: string, existing?: string | null) {
  if (validToken(existing)) {
    const d = await db.customerDevice.findUnique({ where: { tokenHash: hash(existing) } });
    if (d && d.customerId === customerId) { await db.customerDevice.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } }); return existing; }
  }
  const token = randomBytes(32).toString("base64url");
  await db.customerDevice.create({ data: { customerId, tokenHash: hash(token), lastSeenAt: new Date() } });
  // keep the table tidy: at most 10 devices per customer
  const extra = await db.customerDevice.findMany({ where: { customerId }, orderBy: { lastSeenAt: "desc" }, skip: 10, select: { id: true } });
  if (extra.length) await db.customerDevice.deleteMany({ where: { id: { in: extra.map((x) => x.id) } } });
  return token;
}

export async function customerByDevice(token: unknown) {
  if (!validToken(token)) return null;
  const d = await db.customerDevice.findUnique({ where: { tokenHash: hash(token) }, include: { customer: true } });
  if (!d || d.customer.status === "BLOCKED" || d.customer.archivedAt) return null;
  if (!d.lastSeenAt || Date.now() - d.lastSeenAt.getTime() > 3600_000) await db.customerDevice.update({ where: { id: d.id }, data: { lastSeenAt: new Date() } });
  return d.customer;
}

/** Link this device using a booking's private manage link (for customers who booked before devices existed). */
export async function claimDeviceByManageToken(manageToken: unknown, existing?: string | null) {
  if (typeof manageToken !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(manageToken)) return null;
  const a = await db.appointment.findUnique({ where: { manageTokenHash: hashManageToken(manageToken) }, select: { customerId: true } });
  if (!a?.customerId) return null;
  return ensureDevice(a.customerId, existing);
}

export async function customerOverview(token: unknown) {
  const c = await customerByDevice(token);
  if (!c) return null;
  const settings = await getBookingSettings(c.businessId);
  const appts = await db.appointment.findMany({ where: { customerId: c.id }, orderBy: { startsAt: "desc" }, take: 60, include: { service: true, staff: { select: { name: true } } } });
  const now = Date.now();
  const map = (a: (typeof appts)[number]) => {
    const p = zonedParts(a.startsAt);
    const active = a.status === "SCHEDULED" || a.status === "CONFIRMED";
    return {
      id: a.id, status: a.status, service: a.service ? { he: a.service.nameHe, en: a.service.nameEn } : null,
      date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}`,
      durationMin: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000), price: toNumber(a.price), staff: a.staff?.name ?? null,
      canCancel: active && a.startsAt.getTime() > now && canCustomerCancel(a.startsAt.getTime(), now, settings.cancelNoticeMin),
    };
  };
  const upcoming = appts.filter((a) => a.startsAt.getTime() >= now && (a.status === "SCHEDULED" || a.status === "CONFIRMED")).reverse().map(map);
  const history = appts.filter((a) => !(a.startsAt.getTime() >= now && (a.status === "SCHEDULED" || a.status === "CONFIRMED"))).map(map);
  const visits = c.visitCount;
  const spent = toNumber(c.totalSpent);
  return {
    name: [c.firstName, c.lastName].filter(Boolean).join(" "), firstName: c.firstName,
    tier: loyaltyTier(visits, spent), visits, memberSince: c.createdAt.toISOString().slice(0, 10), next: nextMilestone(visits),
    cancelNoticeMin: settings.cancelNoticeMin, upcoming, history,
  };
}

export async function cancelFromPortal(token: unknown, appointmentId: unknown) {
  const c = await customerByDevice(token);
  if (!c || typeof appointmentId !== "string") return { ok: false as const, error: "not_found" };
  const a = await db.appointment.findFirst({ where: { id: appointmentId, customerId: c.id } });
  if (!a) return { ok: false as const, error: "not_found" };
  if (a.status !== "SCHEDULED" && a.status !== "CONFIRMED") return { ok: true as const };
  const settings = await getBookingSettings(a.businessId);
  if (!canCustomerCancel(a.startsAt.getTime(), Date.now(), settings.cancelNoticeMin)) return { ok: false as const, error: "too_late" };
  await db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "customer_online" } });
  await audit({ businessId: a.businessId, userId: null, action: "appointment.cancelled_by_customer", entityType: "Appointment", entityId: a.id });
  await notifyAppointmentEvent("booking_cancelled", a.id);
  await recomputeCustomerStats(a.businessId, c.id).catch(() => {});
  return { ok: true as const };
}

export async function forgetDevice(token: unknown) {
  if (!validToken(token)) return;
  await db.customerDevice.deleteMany({ where: { tokenHash: hash(token) } });
}

/** Owner's choice: "My appointments" is opened by phone number only (no device key). */
export async function customerByPhone(phoneRaw: unknown) {
  const phone = typeof phoneRaw === "string" ? normalizeIsraeliPhone(phoneRaw) : null;
  if (!phone) return null;
  const business = await db.business.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!business) return null;
  const c = await db.customer.findUnique({ where: { businessId_phone: { businessId: business.id, phone } } });
  if (!c || c.status === "BLOCKED" || c.archivedAt) return null;
  return c;
}

async function overviewFor(c: NonNullable<Awaited<ReturnType<typeof customerByPhone>>>) {
  const [settings, appts] = await Promise.all([
    getBookingSettings(c.businessId),
    db.appointment.findMany({ where: { customerId: c.id }, orderBy: { startsAt: "desc" }, take: 60, include: { service: true, staff: { select: { name: true } } } }),
  ]);
  const now = Date.now();
  const isUp = (a: (typeof appts)[number]) => a.startsAt.getTime() >= now && (a.status === "SCHEDULED" || a.status === "CONFIRMED");
  const map = (a: (typeof appts)[number]) => {
    const p = zonedParts(a.startsAt);
    return {
      id: a.id, status: a.status, service: a.service ? { he: a.service.nameHe, en: a.service.nameEn } : null,
      date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}`,
      durationMin: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000), price: toNumber(a.price), staff: a.staff?.name ?? null,
      canCancel: isUp(a) && canCustomerCancel(a.startsAt.getTime(), now, settings.cancelNoticeMin),
    };
  };
  const visits = c.visitCount, spent = toNumber(c.totalSpent);
  return {
    name: [c.firstName, c.lastName].filter(Boolean).join(" "), firstName: c.firstName,
    tier: loyaltyTier(visits, spent), visits, memberSince: c.createdAt.toISOString().slice(0, 10), next: nextMilestone(visits),
    cancelNoticeMin: settings.cancelNoticeMin, upcoming: appts.filter(isUp).reverse().map(map), history: appts.filter((a) => !isUp(a)).map(map),
  };
}

export async function customerOverviewByPhone(phone: unknown) {
  const c = await customerByPhone(phone);
  return c ? overviewFor(c) : null;
}

export async function cancelByPhone(phone: unknown, appointmentId: unknown) {
  const c = await customerByPhone(phone);
  if (!c || typeof appointmentId !== "string") return { ok: false as const, error: "not_found" };
  const a = await db.appointment.findFirst({ where: { id: appointmentId, customerId: c.id } });
  if (!a) return { ok: false as const, error: "not_found" };
  if (a.status !== "SCHEDULED" && a.status !== "CONFIRMED") return { ok: true as const };
  const settings = await getBookingSettings(a.businessId);
  if (!canCustomerCancel(a.startsAt.getTime(), Date.now(), settings.cancelNoticeMin)) return { ok: false as const, error: "too_late" };
  await db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "customer_online" } });
  await audit({ businessId: a.businessId, userId: null, action: "appointment.cancelled_by_customer", entityType: "Appointment", entityId: a.id });
  await notifyAppointmentEvent("booking_cancelled", a.id);
  await recomputeCustomerStats(a.businessId, c.id).catch(() => {});
  return { ok: true as const };
}
