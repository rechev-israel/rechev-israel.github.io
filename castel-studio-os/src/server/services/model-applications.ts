import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { zonedParts } from "@/lib/dates";
import { normalizeIsraeliPhone } from "@/domain/crm";
import { MODEL_ACTIVE, MODEL_DURATION_MIN, MODEL_SERVICE_REF } from "@/domain/experience";
import { audit } from "@/server/audit";
import { sendPush } from "@/server/notify/push";
import { getExperience, uploadPhoto } from "./experience";
import { availableDays, getSlots, hashManageToken, OCCUPYING } from "./online-booking";

/**
 * CASTEL MODEL EXPERIENCE — hair-model applications.
 * - Free, 120 minutes, the barber chooses the cut.
 * - ONE model per calendar day (Asia/Jerusalem): enforced by a unique database index on (businessId, activeDay).
 * - A request is never an appointment: it holds two hours in the calendar until the owner approves (→ one
 *   confirmed appointment, atomically) or rejects / it expires (→ the hold is released).
 */
export class ModelError extends Error {}
const pad = (n: number) => String(n).padStart(2, "0");
const dayKeyOf = (d: Date) => { const p = zonedParts(d); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };
const hm = (d: Date) => { const p = zonedParts(d); return `${pad(p.hour)}:${pad(p.minute)}`; };
const HOLD_REASON = "מודליסט · ממתין לאישור";
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const isRetry = (e: unknown) => { const c = (e as { code?: string }).code; return c === "P2034" || /could not serialize|deadlock/i.test(String(e)); };

/** The hidden "מודליסט" service (never offered by the regular booking flow). Created once; other services are never touched. */
export async function ensureModelService(businessId: string) {
  const s = await db.service.findFirst({ where: { businessId, externalRef: MODEL_SERVICE_REF } });
  if (s) {
    if (s.durationMin !== MODEL_DURATION_MIN || Number(s.price) !== 0 || s.bookableOnline || !s.isActive)
      return db.service.update({ where: { id: s.id }, data: { durationMin: MODEL_DURATION_MIN, price: 0, bookableOnline: false, isActive: true } });
    return s;
  }
  return db.service.create({ data: { businessId, nameHe: "מודליסט", nameEn: "Hair Model", durationMin: MODEL_DURATION_MIN, price: 0, bookableOnline: false, isActive: true, sortOrder: 98, externalRef: MODEL_SERVICE_REF } });
}

async function takenDays(businessId: string) {
  const rows = await db.modelApplication.findMany({ where: { businessId, activeDay: { not: null } }, select: { activeDay: true } });
  return new Set(rows.map((r) => r.activeDay!));
}

/** Days for the application calendar: a day is open only if model requests are on, it isn't disabled, nobody holds it, and a 120-minute window exists. */
export async function modelDays(businessId: string, now = new Date()) {
  const exp = await getExperience(businessId);
  if (!exp.model.enabled) return { enabled: false as const, days: [] };
  const service = await ensureModelService(businessId);
  const [days, taken] = await Promise.all([availableDays(businessId, { serviceId: service.id, staffId: "any" }, now, { includeHidden: true }), takenDays(businessId)]);
  const disabled = new Set(exp.model.disabledDates);
  return {
    enabled: true as const,
    days: days.map((d) => ({ date: d.date, status: disabled.has(d.date) ? "closed" : taken.has(d.date) ? "taken" : d.free > 0 ? "open" : "full" })),
  };
}

export async function modelSlots(businessId: string, date: string, now = new Date()) {
  const exp = await getExperience(businessId);
  if (!exp.model.enabled) throw new ModelError("disabled");
  if (exp.model.disabledDates.includes(date)) throw new ModelError("day_closed");
  if ((await takenDays(businessId)).has(date)) throw new ModelError("day_taken");
  const service = await ensureModelService(businessId);
  const { slots } = await getSlots(businessId, { serviceId: service.id, staffId: "any", date }, now, { includeHidden: true });
  return slots.map((x) => ({ start: x.start, label: hm(new Date(x.start)) }));
}

export type ModelInput = {
  name?: unknown; phone?: unknown; date?: unknown; start?: unknown; notes?: unknown;
  photos?: { front?: unknown; side?: unknown; back?: unknown }; consentTerms?: unknown; consentPhotos?: unknown; deviceToken?: unknown;
};

/** Submit an application (status PENDING_APPROVAL). All three photos and both consents are mandatory. */
export async function submitModelApplication(businessId: string, input: ModelInput, now = new Date()) {
  const exp = await getExperience(businessId);
  if (!exp.model.enabled) throw new ModelError("disabled");
  const name = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const phone = typeof input.phone === "string" ? normalizeIsraeliPhone(input.phone) : null;
  if (name.length < 2) throw new ModelError("name");
  if (!phone) throw new ModelError("phone");
  if (input.consentTerms !== true) throw new ModelError("terms");
  if (input.consentPhotos !== true) throw new ModelError("photo_consent");
  const ph = input.photos ?? {};
  if (typeof ph.front !== "string" || typeof ph.side !== "string" || typeof ph.back !== "string" || !ph.front || !ph.side || !ph.back) throw new ModelError("photos");
  const date = typeof input.date === "string" ? input.date : "";
  const start = Number(input.start);
  const slots = await modelSlots(businessId, date, now);
  if (!slots.some((s) => s.start === start)) throw new ModelError("slot_taken");
  const startsAt = new Date(start), endsAt = new Date(start + MODEL_DURATION_MIN * 60_000);
  const dayKey = dayKeyOf(startsAt);
  if (dayKey !== date) throw new ModelError("slot_taken");

  // Customer (existing CRM record by phone, or a new one).
  let customer = await db.customer.findUnique({ where: { businessId_phone: { businessId, phone } } });
  if (customer?.status === "BLOCKED") throw new ModelError("blocked");
  if (!customer) {
    const [first, ...rest] = name.split(" ");
    try { customer = await db.customer.create({ data: { businessId, firstName: first.slice(0, 80), lastName: rest.join(" ").slice(0, 80) || null, phone, source: "model-application" } }); }
    catch (e) { if (!isUnique(e)) throw e; customer = await db.customer.findUniqueOrThrow({ where: { businessId_phone: { businessId, phone } } }); }
  }

  // Photos (validated: real image files, size). Stored privately; if the request fails they are removed again.
  const ids: string[] = [];
  try {
    for (const [k, v] of [["front", ph.front], ["side", ph.side], ["back", ph.back]] as const) ids.push((await uploadPhoto(businessId, customer.id, v, `מודליסט · ${k === "front" ? "מקדימה" : k === "side" ? "מהצד" : "מאחור"}`)).id);
  } catch (e) {
    if (ids.length) await db.customerPhoto.deleteMany({ where: { id: { in: ids } } });
    throw new ModelError(e instanceof Error && ["too_big", "limit"].includes(e.message) ? e.message : "photo_invalid");
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Math.min(now.getTime() + exp.model.holdHours * 3600_000, startsAt.getTime()));
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const app = await db.$transaction(async (tx) => {
        const clash = await tx.appointment.findFirst({ where: { businessId, status: { in: [...OCCUPYING] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
        const block = await tx.timeOff.findFirst({ where: { businessId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
        if (clash || block) throw new ModelError("slot_taken");
        const hold = await tx.timeOff.create({ data: { businessId, staffId: null, startsAt, endsAt, reason: HOLD_REASON } });
        return tx.modelApplication.create({
          data: { businessId, customerId: customer!.id, dayKey, activeDay: dayKey, startsAt, endsAt, notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 600) || null : null,
            photoFrontId: ids[0], photoSideId: ids[1], photoBackId: ids[2], consentTerms: true, consentPhotos: true, holdId: hold.id, manageTokenHash: hashManageToken(token), expiresAt },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      await audit({ businessId, userId: null, action: "model.applied", entityType: "ModelApplication", entityId: app.id });
      await notifyOwnerModel(app.id).catch((e) => logger.error("notify.model_failed", { err: String(e) }));
      const { ensureDevice } = await import("./customer-portal");
      const deviceToken = await ensureDevice(customer.id, typeof input.deviceToken === "string" ? input.deviceToken : null).catch(() => null);
      return { token, deviceToken, id: app.id };
    } catch (e) {
      if (isUnique(e)) { await db.customerPhoto.deleteMany({ where: { id: { in: ids } } }); throw new ModelError("day_taken"); }
      if (e instanceof ModelError) { await db.customerPhoto.deleteMany({ where: { id: { in: ids } } }); throw e; }
      if (isRetry(e)) { await new Promise((r) => setTimeout(r, 20 + Math.random() * 80 * (attempt + 1))); continue; }
      await db.customerPhoto.deleteMany({ where: { id: { in: ids } } });
      throw e;
    }
  }
  await db.customerPhoto.deleteMany({ where: { id: { in: ids } } });
  throw new ModelError("busy");
}

async function notifyOwnerModel(id: string) {
  const a = await db.modelApplication.findUniqueOrThrow({ where: { id } });
  const c = await db.customer.findUnique({ where: { id: a.customerId }, select: { firstName: true, lastName: true } });
  const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "לקוח";
  const p = zonedParts(a.startsAt);
  const when = `${pad(p.day)}.${pad(p.month)}.${p.year} · ${hm(a.startsAt)}`;
  const title = "בקשת מודליסט חדשה התקבלה!";
  const body = `לקוח: ${name}\nתאריך: ${pad(p.day)}.${pad(p.month)}.${p.year}\nשעה: ${hm(a.startsAt)}\nמשך: שעתיים\nתמונות שיער: 3 תמונות\nסטטוס: ממתין לאישור שלך`;
  try {
    await db.notification.create({ data: { businessId: a.businessId, kind: "model_application", level: "warn", title, body, link: `/models?app=${a.id}`, entityId: a.id, dedupeKey: `model:${a.id}` } });
  } catch (e) { if (isUnique(e)) return; throw e; }
  const owners = await db.user.findMany({ where: { businessId: a.businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { id: true } });
  await sendPush(a.businessId, owners.map((o) => o.id), { title, body: `${name} · ${when} · שעתיים · ממתין לאישור`, url: `/models?app=${a.id}`, tag: `model-${a.id}` });
}

/** Owner only: approve → exactly one confirmed 120-minute appointment, re-validated and created atomically. */
export async function approveModel(user: { id: string; businessId: string; role: string }, id: string) {
  if (user.role !== "OWNER") throw new ModelError("forbidden");
  const service = await ensureModelService(user.businessId);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const appt = await db.$transaction(async (tx) => {
        const a = await tx.modelApplication.findFirst({ where: { id, businessId: user.businessId } });
        if (!a) throw new ModelError("not_found");
        if (a.status !== "PENDING_APPROVAL") throw new ModelError("not_pending");
        if (a.startsAt.getTime() <= Date.now()) throw new ModelError("past");
        const other = await tx.modelApplication.findFirst({ where: { businessId: user.businessId, activeDay: a.dayKey, id: { not: a.id } }, select: { id: true } });
        if (other) throw new ModelError("day_taken");
        if (a.holdId) await tx.timeOff.deleteMany({ where: { id: a.holdId, businessId: user.businessId } });
        const clash = await tx.appointment.findFirst({ where: { businessId: user.businessId, status: { in: [...OCCUPYING] }, startsAt: { lt: a.endsAt }, endsAt: { gt: a.startsAt } }, select: { id: true } });
        const block = await tx.timeOff.findFirst({ where: { businessId: user.businessId, startsAt: { lt: a.endsAt }, endsAt: { gt: a.startsAt } }, select: { id: true } });
        if (clash || block) throw new ModelError("conflict");
        const staff = await tx.user.findFirst({ where: { businessId: user.businessId, isActive: true, acceptsBookings: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
        const branch = await tx.branch.findFirst({ where: { businessId: user.businessId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
        const created = await tx.appointment.create({ data: { businessId: user.businessId, branchId: branch?.id, customerId: a.customerId, serviceId: service.id, staffId: staff?.id ?? null, startsAt: a.startsAt, endsAt: a.endsAt, status: "CONFIRMED", price: 0, source: "model", notes: "CASTEL MODEL · מודליסט (התספורת בבחירת הספר)" } });
        await tx.modelApplication.update({ where: { id: a.id }, data: { status: "APPROVED", appointmentId: created.id, holdId: null, decidedAt: new Date(), decidedById: user.id } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      await audit({ businessId: user.businessId, userId: user.id, action: "model.approved", entityType: "ModelApplication", entityId: id });
      const { recomputeCustomerStats } = await import("./crm");
      if (appt.customerId) await recomputeCustomerStats(user.businessId, appt.customerId).catch(() => {});
      return appt;
    } catch (e) {
      if (e instanceof ModelError) throw e;
      if (isRetry(e)) { await new Promise((r) => setTimeout(r, 20 + Math.random() * 80 * (attempt + 1))); continue; }
      throw e;
    }
  }
  throw new ModelError("busy");
}

/** Owner: reject (optionally with a reason and/or an alternative date). The calendar hold is released. */
export async function rejectModel(user: { id: string; businessId: string; role: string }, id: string, opts: { reason?: string; altStartsAt?: Date | null } = {}) {
  if (user.role !== "OWNER" && user.role !== "MANAGER") throw new ModelError("forbidden");
  const cfg = (await getExperience(user.businessId)).model;
  const a = await db.modelApplication.findFirst({ where: { id, businessId: user.businessId } });
  if (!a) throw new ModelError("not_found");
  if (a.status !== "PENDING_APPROVAL") throw new ModelError("not_pending");
  await db.$transaction([
    ...(a.holdId ? [db.timeOff.deleteMany({ where: { id: a.holdId, businessId: user.businessId } })] : []),
    db.modelApplication.update({ where: { id: a.id }, data: {
      status: opts.altStartsAt ? "ALT_PROPOSED" : "REJECTED", holdId: null, activeDay: cfg.releaseOnReject ? null : a.activeDay,
      rejectReason: opts.reason?.trim().slice(0, 300) || null, altStartsAt: opts.altStartsAt ?? null, decidedAt: new Date(), decidedById: user.id,
    } }),
  ]);
  await audit({ businessId: user.businessId, userId: user.id, action: opts.altStartsAt ? "model.alternative_proposed" : "model.rejected", entityType: "ModelApplication", entityId: id });
}

/** The applicant's private link: status only (no other customer's data). */
export async function modelByToken(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const a = await db.modelApplication.findUnique({ where: { manageTokenHash: hashManageToken(token) } });
  if (!a) return null;
  if (a.status === "PENDING_APPROVAL" && (a.expiresAt < new Date() || a.startsAt < new Date())) await expireOne(a.id);
  const fresh = (await db.modelApplication.findUnique({ where: { id: a.id } }))!;
  return publicView(fresh);
}

export function publicView(a: { id: string; status: string; dayKey: string; startsAt: Date; endsAt: Date; rejectReason: string | null; altStartsAt: Date | null; createdAt: Date; expiresAt: Date }) {
  return {
    status: a.status, date: a.dayKey, time: hm(a.startsAt), durationMin: MODEL_DURATION_MIN, reason: a.rejectReason,
    alt: a.altStartsAt ? { date: dayKeyOf(a.altStartsAt), time: hm(a.altStartsAt) } : null, submittedAt: a.createdAt.toISOString(),
    canCancel: a.status === "PENDING_APPROVAL" || (a.status === "APPROVED" && a.startsAt.getTime() > Date.now()),
  };
}

/** The applicant cancels (pending or approved). Releases the day and the hold; an approved appointment is cancelled too. */
export async function cancelModelByToken(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new ModelError("not_found");
  const a = await db.modelApplication.findUnique({ where: { manageTokenHash: hashManageToken(token) } });
  if (!a) throw new ModelError("not_found");
  if (!(MODEL_ACTIVE as readonly string[]).includes(a.status)) return;
  await db.$transaction([
    ...(a.holdId ? [db.timeOff.deleteMany({ where: { id: a.holdId } })] : []),
    ...(a.appointmentId ? [db.appointment.updateMany({ where: { id: a.appointmentId, status: { in: ["SCHEDULED", "CONFIRMED"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "customer_online" } })] : []),
    db.modelApplication.update({ where: { id: a.id }, data: { status: "CANCELLED", activeDay: null, holdId: null } }),
  ]);
  await audit({ businessId: a.businessId, userId: null, action: "model.cancelled_by_customer", entityType: "ModelApplication", entityId: a.id });
}

async function expireOne(id: string) {
  const a = await db.modelApplication.findUnique({ where: { id } });
  if (!a || a.status !== "PENDING_APPROVAL") return;
  await db.$transaction([
    ...(a.holdId ? [db.timeOff.deleteMany({ where: { id: a.holdId } })] : []),
    db.modelApplication.update({ where: { id }, data: { status: "EXPIRED", activeDay: null, holdId: null } }),
  ]);
}

/**
 * Heartbeat: expire unanswered requests (releases the hold), close approved ones whose appointment was cancelled,
 * and delete the photos of closed requests after the owner's retention period.
 */
export async function modelTick(businessId: string, now = new Date()) {
  const due = await db.modelApplication.findMany({ where: { businessId, status: "PENDING_APPROVAL", OR: [{ expiresAt: { lt: now } }, { startsAt: { lt: now } }] }, select: { id: true } });
  for (const a of due) await expireOne(a.id);
  const approved = await db.modelApplication.findMany({ where: { businessId, status: "APPROVED", appointmentId: { not: null } }, select: { id: true, appointmentId: true } });
  if (approved.length) {
    const cancelled = await db.appointment.findMany({ where: { id: { in: approved.map((a) => a.appointmentId!) }, status: "CANCELLED" }, select: { id: true } });
    const ids = new Set(cancelled.map((c) => c.id));
    for (const a of approved.filter((x) => ids.has(x.appointmentId!))) await db.modelApplication.update({ where: { id: a.id }, data: { status: "CANCELLED", activeDay: null } });
  }
  const cfg = (await getExperience(businessId)).model;
  const cutoff = new Date(now.getTime() - cfg.photoRetentionDays * 86400_000);
  const old = await db.modelApplication.findMany({ where: { businessId, photosDeletedAt: null, OR: [{ status: { in: ["REJECTED", "EXPIRED", "CANCELLED", "ALT_PROPOSED"] }, updatedAt: { lt: cutoff } }, { status: "APPROVED", endsAt: { lt: cutoff } }] } });
  for (const a of old) await deleteModelPhotos(a.id);
  return due.length;
}

export async function deleteModelPhotos(id: string) {
  const a = await db.modelApplication.findUnique({ where: { id } });
  if (!a) return;
  const ids = [a.photoFrontId, a.photoSideId, a.photoBackId].filter((x): x is string => !!x);
  await db.$transaction([db.customerPhoto.deleteMany({ where: { id: { in: ids } } }), db.modelApplication.update({ where: { id }, data: { photoFrontId: null, photoSideId: null, photoBackId: null, photosDeletedAt: new Date() } })]);
}
