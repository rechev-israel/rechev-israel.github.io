import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import { zonedDate, zonedParts } from "@/lib/dates";
import { normalizeIsraeliPhone } from "@/domain/crm";
import { canCustomerCancel, computeSlots, hhmm, pickStaff, type Interval, type StaffDay } from "@/domain/booking";
import { toNumber } from "@/lib/utils";
import { emitAppointment } from "./bookings";
import { recomputeCustomerStats } from "./crm";
import { notifyAppointmentEvent } from "@/server/notify/owner";

const ACTIVE = ["SCHEDULED", "CONFIRMED"] as const;
/** Statuses that occupy the chair. A completed or no-show appointment still happened in that time, so it keeps blocking it. */
export const OCCUPYING = ["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW"] as const;
export const hashManageToken = (t: string) => createHash("sha256").update(t).digest("hex");

export class BookingError extends Error {
  constructor(public code: "disabled" | "service" | "staff" | "date" | "slot_taken" | "phone" | "limit" | "not_found" | "too_late" | "busy") { super(code); }
}

/** Single-business deployment: the public site belongs to the first business. */
export async function publicBusiness() {
  return db.business.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, city: true, timezone: true } });
}

export async function getBookingSettings(businessId: string) {
  return db.bookingSettings.upsert({ where: { businessId }, create: { businessId }, update: {} });
}

export async function bookableStaff(businessId: string) {
  return db.user.findMany({ where: { businessId, isActive: true, acceptsBookings: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
}

export function parseDay(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const noon = zonedDate(y, mo, d, 12);
  const p = zonedParts(noon);
  if (p.year !== y || p.month !== mo || p.day !== d) return null;
  return { y, mo, d, weekday: p.weekday, start: zonedDate(y, mo, d).getTime(), end: zonedDate(y, mo, d, 23, 59).getTime() + 60_000 };
}

/** Bookable days from today to maxDaysAhead (YYYY-MM-DD, business timezone). */
export function bookableDates(maxDaysAhead: number, now = new Date()) {
  const out: string[] = [];
  const p = zonedParts(now);
  for (let i = 0; i <= maxDaysAhead; i++) {
    const q = zonedParts(zonedDate(p.year, p.month, p.day + i, 12));
    out.push(`${q.year}-${String(q.month).padStart(2, "0")}-${String(q.day).padStart(2, "0")}`);
  }
  return out;
}

type RangeData = {
  rules: { staffId: string | null; weekday: number; startTime: string; endTime: string }[];
  appts: { staffId: string | null; startsAt: Date; endsAt: Date }[];
  off: { staffId: string | null; startsAt: Date; endsAt: Date }[];
  totalBookable: number;
};

/** One round of queries for a whole date range (used by both single-day slots and the month calendar). */
async function loadRange(businessId: string, staffIds: string[], from: number, to: number, excludeAppointmentId?: string): Promise<RangeData | null> {
  const branch = await db.branch.findFirst({ where: { businessId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!branch) return null;
  const [rules, appts, off, totalBookable] = await Promise.all([
    db.availabilityRule.findMany({ where: { branchId: branch.id, isActive: true, OR: [{ staffId: null }, { staffId: { in: staffIds } }] }, select: { staffId: true, weekday: true, startTime: true, endTime: true } }),
    db.appointment.findMany({
      where: { businessId, status: { in: [...OCCUPYING] }, startsAt: { lt: new Date(to) }, endsAt: { gt: new Date(from) }, ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}) },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
    db.timeOff.findMany({ where: { businessId, startsAt: { lt: new Date(to) }, endsAt: { gt: new Date(from) } }, select: { staffId: true, startsAt: true, endsAt: true } }),
    db.user.count({ where: { businessId, isActive: true, acceptsBookings: true } }),
  ]);
  return { rules, appts, off, totalBookable };
}

function daySchedule(day: NonNullable<ReturnType<typeof parseDay>>, staffIds: string[], r: RangeData): StaffDay[] {
  const toWindow = (x: { startTime: string; endTime: string }): Interval | null => {
    const a = hhmm(x.startTime), b = hhmm(x.endTime);
    if (a == null || b == null || b <= a) return null;
    return { start: zonedDate(day.y, day.mo, day.d, Math.floor(a / 60), a % 60).getTime(), end: zonedDate(day.y, day.mo, day.d, Math.floor(b / 60), b % 60).getTime() };
  };
  const inDay = <T extends { startsAt: Date; endsAt: Date }>(x: T) => x.startsAt.getTime() < day.end && x.endsAt.getTime() > day.start;
  return staffIds.map((id) => {
    const own = r.rules.filter((x) => x.staffId === id);
    // A barber with their own schedule uses only it (days without rows are days off); otherwise shop hours.
    const source = own.length ? own : r.rules.filter((x) => x.staffId === null);
    const windows = source.filter((x) => x.weekday === day.weekday).map(toWindow).filter((w): w is Interval => Boolean(w));
    const busy: Interval[] = [
      // Unassigned appointments (entered manually or imported) block the chair when there is only one bookable barber.
      ...r.appts.filter(inDay).filter((a) => a.staffId === id || (a.staffId === null && r.totalBookable <= 1)).map((a) => ({ start: a.startsAt.getTime(), end: a.endsAt.getTime() })),
      ...r.off.filter(inDay).filter((o) => o.staffId === null || o.staffId === id).map((o) => ({ start: o.startsAt.getTime(), end: o.endsAt.getTime() })),
    ];
    return { id, windows, busy };
  });
}

/** Opening windows, busy blocks and time off for each staff member on one day. */
export async function staffDays(businessId: string, date: string, staffIds: string[], excludeAppointmentId?: string): Promise<StaffDay[]> {
  const day = parseDay(date);
  if (!day || !staffIds.length) return [];
  const r = await loadRange(businessId, staffIds, day.start, day.end, excludeAppointmentId);
  return r ? daySchedule(day, staffIds, r) : [];
}

/** Which bookable days have at least one free slot for this service/barber (for the date calendar). */
export async function availableDays(businessId: string, q: { serviceId: string; staffId: string; withSlots?: boolean }, now = new Date()) {
  const settings = await getBookingSettings(businessId);
  if (!settings.enabled) throw new BookingError("disabled");
  const service = await db.service.findFirst({ where: { id: q.serviceId, businessId, isActive: true, bookableOnline: true } });
  if (!service) throw new BookingError("service");
  const staff = await bookableStaff(businessId);
  const ids = q.staffId === "any" ? staff.map((s) => s.id) : staff.some((s) => s.id === q.staffId) ? [q.staffId] : [];
  if (!ids.length) throw new BookingError("staff");
  const dates = bookableDates(settings.maxDaysAhead, now);
  const days = dates.map(parseDay).filter((d): d is NonNullable<ReturnType<typeof parseDay>> => Boolean(d));
  const r = await loadRange(businessId, ids, days[0].start, days[days.length - 1].end);
  if (!r) return [];
  return days.map((day, i) => {
    const slots = computeSlots({ staff: daySchedule(day, ids, r), durationMin: service.durationMin, stepMin: settings.slotStepMin, bufferMin: settings.bufferMin, now: now.getTime(), minNoticeMin: settings.minNoticeMin });
    if (!q.withSlots) return { date: dates[i], free: slots.length };
    // Times for every day in one response, so the website can show them instantly (re-validated on booking).
    return { date: dates[i], free: slots.length, slots: slots.map((x) => { const p = zonedParts(new Date(x.start)); return { start: x.start, label: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}` }; }) };
  });
}

export async function getSlots(businessId: string, q: { serviceId: string; staffId: string; date: string }, now = new Date()) {
  const settings = await getBookingSettings(businessId);
  if (!settings.enabled) throw new BookingError("disabled");
  const service = await db.service.findFirst({ where: { id: q.serviceId, businessId, isActive: true, bookableOnline: true } });
  if (!service) throw new BookingError("service");
  if (!bookableDates(settings.maxDaysAhead, now).includes(q.date)) throw new BookingError("date");
  const staff = await bookableStaff(businessId);
  const ids = q.staffId === "any" ? staff.map((s) => s.id) : staff.some((s) => s.id === q.staffId) ? [q.staffId] : [];
  if (!ids.length) throw new BookingError("staff");
  const days = await staffDays(businessId, q.date, ids);
  return { service, slots: computeSlots({ staff: days, durationMin: service.durationMin, stepMin: settings.slotStepMin, bufferMin: settings.bufferMin, now: now.getTime(), minNoticeMin: settings.minNoticeMin }) };
}

export type BookingInput = { serviceId: string; staffId: string; date: string; start: number; name: string; phone: string; notes?: string; marketingConsent?: boolean; locale?: string; deviceToken?: string };

/** Create an online booking. Re-checks availability inside a SERIALIZABLE transaction, so two people can never take the same slot. */
export async function createOnlineBooking(businessId: string, input: BookingInput, now = new Date()) {
  const phone = normalizeIsraeliPhone(input.phone);
  if (!phone) throw new BookingError("phone");
  const { service, slots } = await getSlots(businessId, input, now);
  const slot = slots.find((s) => s.start === input.start);
  if (!slot) throw new BookingError("slot_taken");
  const settings = await getBookingSettings(businessId);
  const startsAt = new Date(input.start);
  const endsAt = new Date(input.start + service.durationMin * 60_000);
  const token = randomBytes(24).toString("base64url");
  const [firstName, ...rest] = input.name.trim().split(/\s+/);

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const appt = await db.$transaction(async (tx) => {
        // Who is free right now for this exact slot (fresh read inside the transaction)?
        const day = parseDay(input.date)!;
        const dayAppts = await tx.appointment.groupBy({ by: ["staffId"], where: { businessId, status: { in: [...ACTIVE] }, startsAt: { gte: new Date(day.start), lt: new Date(day.end) } }, _count: true });
        const load = Object.fromEntries(dayAppts.map((r) => [r.staffId ?? "", r._count]));
        const singleChair = (await tx.user.count({ where: { businessId, isActive: true, acceptsBookings: true } })) <= 1;
        const free: string[] = [];
        for (const sid of slot.staffIds) {
          const clash = await tx.appointment.findFirst({ where: { businessId, status: { in: [...OCCUPYING] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, OR: [{ staffId: sid }, ...(singleChair ? [{ staffId: null }] : [])] }, select: { id: true } });
          if (!clash) free.push(sid);
        }
        const staffId = pickStaff(free, load);
        if (!staffId) throw new BookingError("slot_taken");

        let customer = await tx.customer.findUnique({ where: { businessId_phone: { businessId, phone } } });
        // Returning customer typed a different name: keep the CRM name, but record what was typed on the booking.
        const typedName = input.name.trim();
        const nameNote = customer && [customer.firstName, customer.lastName].filter(Boolean).join(" ") !== typedName ? `נקבע בשם: ${typedName}` : "";
        if (customer?.status === "BLOCKED") throw new BookingError("limit");
        if (customer) {
          const active = await tx.appointment.count({ where: { customerId: customer.id, status: { in: [...ACTIVE] }, startsAt: { gt: now } } });
          if (active >= settings.maxActivePerPhone) throw new BookingError("limit");
          if (input.marketingConsent && customer.marketingConsentWhatsapp !== "OPTED_IN")
            customer = await tx.customer.update({ where: { id: customer.id }, data: { marketingConsentWhatsapp: "OPTED_IN", marketingConsentSms: "OPTED_IN", consentUpdatedAt: new Date() } });
        } else {
          customer = await tx.customer.create({
            data: {
              businessId, firstName: firstName.slice(0, 80), lastName: rest.join(" ").slice(0, 80) || null, phone, source: "online-booking",
              ...(input.marketingConsent ? { marketingConsentWhatsapp: "OPTED_IN", marketingConsentSms: "OPTED_IN", consentUpdatedAt: new Date() } : {}),
            },
          });
        }
        const branch = await tx.branch.findFirst({ where: { businessId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
        return tx.appointment.create({
          data: {
            businessId, branchId: branch?.id, customerId: customer.id, serviceId: service.id, staffId, startsAt, endsAt,
            status: settings.autoConfirm ? "CONFIRMED" : "SCHEDULED", price: service.price, source: "online",
            notes: [nameNote, input.notes?.trim().slice(0, 500)].filter(Boolean).join("\n") || null, manageTokenHash: hashManageToken(token),
          },
          include: { staff: { select: { name: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });

      await audit({ businessId, userId: null, action: "appointment.online_booked", entityType: "Appointment", entityId: appt.id });
      await notifyAppointmentEvent(settings.autoConfirm ? "booking_created" : "booking_pending", appt.id);
      await emitAppointment(businessId, "appointment.created", appt.id).catch((e) => logger.warn("booking.emit_failed", { err: String(e) }));
      if (appt.customerId) await recomputeCustomerStats(businessId, appt.customerId).catch(() => {});
      const { ensureDevice } = await import("./customer-portal");
      const deviceToken = appt.customerId ? await ensureDevice(appt.customerId, input.deviceToken).catch(() => null) : null;
      return { token, appointment: appt, deviceToken };
    } catch (e) {
      if (e instanceof BookingError) throw e;
      const code = (e as { code?: string }).code;
      if (code === "P2034" || code === "P2002" || /could not serialize|deadlock/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 80 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new BookingError("busy");
}

export async function findByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db.appointment.findUnique({
    where: { manageTokenHash: hashManageToken(token) },
    include: { service: true, staff: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } }, business: { select: { id: true, name: true, city: true } } },
  });
}

export async function cancelByToken(token: string, now = new Date()) {
  const a = await findByToken(token);
  if (!a) throw new BookingError("not_found");
  if (!ACTIVE.includes(a.status as (typeof ACTIVE)[number])) return a;
  const settings = await getBookingSettings(a.businessId);
  if (!canCustomerCancel(a.startsAt.getTime(), now.getTime(), settings.cancelNoticeMin)) throw new BookingError("too_late");
  await db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: "customer_online" } });
  await audit({ businessId: a.businessId, userId: null, action: "appointment.cancelled_by_customer", entityType: "Appointment", entityId: a.id });
  await notifyAppointmentEvent("booking_cancelled", a.id);
  if (a.customerId) await recomputeCustomerStats(a.businessId, a.customerId).catch(() => {});
  return { ...a, status: "CANCELLED" as const };
}

export const priceOf = (p: Prisma.Decimal | null) => toNumber(p);
