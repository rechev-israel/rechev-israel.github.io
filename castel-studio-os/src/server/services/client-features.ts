import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeIsraeliPhone } from "@/domain/crm";
import { isGiftCode, makeGiftCode } from "@/domain/experience";
import { sendPush } from "@/server/notify/push";
import { getExperience, uploadPhoto } from "./experience";

/**
 * Client website features built on the existing records: special requests per appointment,
 * gift cards with a manual (owner-confirmed) payment flow, and the shop's live status buttons.
 */
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const short = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || null : null);
const ACTIVE = ["SCHEDULED", "CONFIRMED"] as const;

async function tellOwners(businessId: string, n: { kind: string; title: string; body: string; link: string; dedupeKey: string; entityId?: string }) {
  try {
    await db.notification.create({ data: { businessId, kind: n.kind, level: "info", title: n.title, body: n.body, link: n.link, entityId: n.entityId, dedupeKey: n.dedupeKey } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
  const owners = await db.user.findMany({ where: { businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { id: true } });
  await sendPush(businessId, owners.map((o) => o.id), { title: n.title, body: n.body, url: n.link, tag: n.dedupeKey }).catch(() => null);
}

// ───────── Special requests ─────────

/** The customer's own upcoming, still-active appointment (requests can be edited until it starts). */
async function ownUpcoming(customerId: string, appointmentId: unknown) {
  if (typeof appointmentId !== "string") throw new Error("not_found");
  const a = await db.appointment.findFirst({ where: { id: appointmentId, customerId, status: { in: [...ACTIVE] } } });
  if (!a) throw new Error("not_found");
  if (a.startsAt.getTime() <= Date.now()) throw new Error("too_late");
  return a;
}

export async function getRequest(customerId: string, appointmentId: unknown) {
  const a = await ownUpcoming(customerId, appointmentId);
  const r = await db.appointmentRequest.findUnique({ where: { appointmentId: a.id } });
  return r ? { style: r.style, fade: r.fade, beard: r.beard, changes: r.changes, note: r.note, photoId: r.photoId, updatedAt: r.updatedAt.toISOString() } : null;
}

/**
 * Save the request for one appointment (one per appointment). An inspiration photo is stored privately and
 * shared with the barber only for this purpose (the customer is told so in the form). Never changes price or duration.
 */
export async function saveRequest(customer: { id: string; businessId: string }, appointmentId: unknown, input: Record<string, unknown>) {
  const a = await ownUpcoming(customer.id, appointmentId);
  let photoId: string | null = typeof input.photoId === "string" && input.photoId ? input.photoId : null;
  if (typeof input.photo === "string" && input.photo) {
    photoId = (await uploadPhoto(customer.businessId, customer.id, input.photo, "השראה לתור")).id;
    await db.customerPhoto.update({ where: { id: photoId }, data: { sharedWithBarber: true } });
  } else if (photoId && !(await db.customerPhoto.findFirst({ where: { id: photoId, customerId: customer.id } }))) throw new Error("photo");
  if (photoId) await db.customerPhoto.update({ where: { id: photoId }, data: { sharedWithBarber: true } });
  const data = { style: short(input.style, 80), fade: short(input.fade, 80), beard: short(input.beard, 120), changes: short(input.changes, 300), note: typeof input.note === "string" ? input.note.trim().slice(0, 600) || null : null, photoId };
  if (!Object.values(data).some(Boolean)) throw new Error("empty");
  const existed = await db.appointmentRequest.findUnique({ where: { appointmentId: a.id } });
  const r = await db.appointmentRequest.upsert({ where: { appointmentId: a.id }, create: { businessId: a.businessId, appointmentId: a.id, customerId: customer.id, ...data }, update: data });
  if (!existed) {
    const c = await db.customer.findUnique({ where: { id: customer.id }, select: { firstName: true } });
    await tellOwners(a.businessId, { kind: "appointment_request", title: `בקשה מיוחדת לתור: ${c?.firstName ?? "לקוח"}`, body: (data.changes || data.note || data.style || "תמונת השראה").slice(0, 140), link: `/bookings?appt=${a.id}&date=${a.startsAt.toISOString().slice(0, 10)}&view=day`, dedupeKey: `request:${a.id}`, entityId: a.id }).catch((e) => logger.error("notify.request_failed", { err: String(e) }));
  }
  return r;
}

export async function removeRequest(customerId: string, appointmentId: unknown) {
  const a = await ownUpcoming(customerId, appointmentId);
  await db.appointmentRequest.deleteMany({ where: { appointmentId: a.id } });
}

// ───────── Gift cards ─────────

/**
 * A gift card request from the website. No payment here: the shop contacts the buyer, takes payment
 * its usual way and then marks it paid — only then a redemption code exists.
 */
export async function requestGift(input: Record<string, unknown>, businessId?: string) {
  const b = businessId ? { id: businessId } : await db.business.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!b) throw new Error("disabled");
  const cfg = (await getExperience(b.id)).gifts;
  if (!cfg.enabled) throw new Error("disabled");
  const phone = typeof input.buyerPhone === "string" ? normalizeIsraeliPhone(input.buyerPhone) : null;
  const buyerName = short(input.buyerName, 60), recipientName = short(input.recipientName, 60);
  if (!phone || !buyerName || !recipientName || input.terms !== true) throw new Error("invalid");
  let kind: "service" | "amount", serviceId: string | null = null, serviceName: string | null = null, amount: number | null = null;
  if (input.kind === "service" && cfg.allowServices) {
    const s = typeof input.serviceId === "string" ? await db.service.findFirst({ where: { id: input.serviceId, businessId: b.id, isActive: true, bookableOnline: true } }) : null;
    if (!s) throw new Error("invalid");
    kind = "service"; serviceId = s.id; serviceName = s.nameHe; amount = Number(s.price);
  } else {
    amount = Number(input.amount);
    if (!cfg.amounts.includes(amount)) throw new Error("invalid");
    kind = "amount";
  }
  const design = ["noir", "gold", "ivory"].includes(String(input.design)) ? String(input.design) : "noir";
  const viewToken = randomBytes(24).toString("base64url");
  const customer = await db.customer.findUnique({ where: { businessId_phone: { businessId: b.id, phone } }, select: { id: true } });
  const g = await db.giftCard.create({ data: { businessId: b.id, kind, serviceId, serviceName, amount, recipientName, message: typeof input.message === "string" ? input.message.trim().slice(0, 300) || null : null, design, buyerName, buyerPhone: phone, buyerCustomerId: customer?.id ?? null, viewTokenHash: hash(viewToken) } });
  await tellOwners(b.id, { kind: "gift_request", title: `בקשה לכרטיס מתנה: ${buyerName}`, body: `${serviceName ?? `₪${amount}`} עבור ${recipientName} · ${phone}`, link: "/experience?tab=gifts", dedupeKey: `gift:${g.id}`, entityId: g.id }).catch(() => null);
  return { viewToken };
}

/** The buyer's private link: status, and the card with its code once it's paid. */
export async function giftByToken(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const g = await db.giftCard.findUnique({ where: { viewTokenHash: hash(token) } });
  if (!g) return null;
  if (g.status === "ACTIVE" && g.expiresAt && g.expiresAt < new Date()) await db.giftCard.update({ where: { id: g.id }, data: { status: "EXPIRED" } });
  const cfg = (await getExperience(g.businessId)).gifts;
  const status = g.status === "ACTIVE" && g.expiresAt && g.expiresAt < new Date() ? "EXPIRED" : g.status;
  return {
    status, kind: g.kind, serviceName: g.serviceName, amount: g.amount, recipientName: g.recipientName, message: g.message, design: g.design,
    code: status === "ACTIVE" || status === "REDEEMED" ? g.code : null, expiresAt: g.expiresAt?.toISOString().slice(0, 10) ?? null, terms: cfg.terms, payNote: cfg.payNote,
  };
}

export async function markGiftPaid(user: { id: string; businessId: string }, id: string, now = new Date()) {
  const cfg = (await getExperience(user.businessId)).gifts;
  for (let i = 0; i < 6; i++) {
    try {
      const expiresAt = cfg.expiryMonths ? new Date(new Date(now).setMonth(now.getMonth() + cfg.expiryMonths)) : null;
      const r = await db.giftCard.updateMany({ where: { id, businessId: user.businessId, status: "REQUESTED" }, data: { status: "ACTIVE", code: makeGiftCode(), paidAt: now, paidById: user.id, expiresAt } });
      return r.count === 1;
    } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
  }
  throw new Error("code collision");
}

/** Redeem once: only an active, unexpired card; two simultaneous attempts can't both succeed. */
export async function redeemGift(user: { id: string; businessId: string }, codeOrId: string, now = new Date()) {
  const where = isGiftCode(codeOrId.trim().toUpperCase()) ? { code: codeOrId.trim().toUpperCase() } : { id: codeOrId };
  const g = await db.giftCard.findFirst({ where: { ...where, businessId: user.businessId } });
  if (!g) return { ok: false as const, error: "not_found" };
  if (g.status === "REDEEMED") return { ok: false as const, error: "already" };
  if (g.status !== "ACTIVE") return { ok: false as const, error: g.status === "REQUESTED" ? "unpaid" : "inactive" };
  if (g.expiresAt && g.expiresAt < now) { await db.giftCard.update({ where: { id: g.id }, data: { status: "EXPIRED" } }); return { ok: false as const, error: "expired" }; }
  const r = await db.giftCard.updateMany({ where: { id: g.id, status: "ACTIVE" }, data: { status: "REDEEMED", redeemedAt: now, redeemedById: user.id } });
  return r.count === 1 ? { ok: true as const, gift: g } : { ok: false as const, error: "already" };
}

// ───────── Live status (set by the shop) ─────────

export async function setLiveStatus(user: { businessId: string }, appointmentId: string, status: "delay" | "ready" | "clear", delayMin?: number) {
  const data = status === "clear" ? { liveStatus: null, liveDelayMin: null, liveUpdatedAt: null }
    : { liveStatus: status, liveDelayMin: status === "delay" ? Math.max(5, Math.min(120, Math.round(delayMin ?? 10))) : null, liveUpdatedAt: new Date() };
  const r = await db.appointment.updateMany({ where: { id: appointmentId, businessId: user.businessId, status: { in: [...ACTIVE] } }, data });
  return r.count === 1;
}
