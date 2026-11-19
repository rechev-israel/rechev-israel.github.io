import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPush } from "@/server/notify/push";
import { findByToken } from "./online-booking";

export class ReviewError extends Error {}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** "Ilay Jerbi" → "Ilay J." — reviews are public, so only a first name and an initial are shown. */
export const publicName = (name: string) => { const [f, ...r] = name.trim().split(/\s+/); return r.length ? `${f} ${r[r.length - 1][0]}.` : f || ""; };

/**
 * A customer's review, left with the private booking link (so only real customers can review, one per appointment).
 * New and edited reviews wait for the owner's approval before they appear on the website.
 */
export async function submitReview(token: string, input: { rating: unknown; text?: unknown; name?: unknown }) {
  const a = await findByToken(token);
  if (!a) throw new ReviewError("not_found");
  if (a.status === "CANCELLED") throw new ReviewError("cancelled");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("rating");
  const fallback = [a.customer?.firstName, a.customer?.lastName].filter(Boolean).join(" ");
  const name = clean(input.name, 60) || fallback || "לקוח";
  const text = clean(input.text, 600) || null;
  const existing = await db.review.findUnique({ where: { appointmentId: a.id } });
  if (existing) {
    return db.review.update({ where: { id: existing.id }, data: { rating, text, name, status: existing.status === "HIDDEN" ? "HIDDEN" : "PENDING" } });
  }
  const r = await db.review.create({ data: { businessId: a.businessId, customerId: a.customerId, appointmentId: a.id, rating, text, name } });
  await notifyOwnerReview(r).catch((e) => logger.error("notify.review_failed", { err: String(e) }));
  return r;
}

async function notifyOwnerReview(r: { id: string; businessId: string; name: string; rating: number; text: string | null }) {
  const title = `ביקורת חדשה ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}: ${r.name}`;
  const body = r.text ? r.text.slice(0, 140) : "ללא טקסט";
  try {
    await db.notification.create({ data: { businessId: r.businessId, kind: "review", level: r.rating <= 2 ? "warn" : "success", title, body, link: "/reviews", entityId: r.id, dedupeKey: `review:${r.id}` } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
  const owners = await db.user.findMany({ where: { businessId: r.businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { id: true } });
  await sendPush(r.businessId, owners.map((o) => o.id), { title, body, url: "/reviews", tag: `review-${r.id}` });
}

export async function reviewForAppointment(appointmentId: string) {
  const r = await db.review.findUnique({ where: { appointmentId }, select: { rating: true, text: true, status: true } });
  return r ? { rating: r.rating, text: r.text ?? "", status: r.status } : null;
}

/** Published reviews for the website. */
export async function publicReviews(businessId: string, limit = 20) {
  const [agg, items] = await Promise.all([
    db.review.aggregate({ where: { businessId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true }),
    db.review.findMany({ where: { businessId, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: limit, select: { name: true, rating: true, text: true, createdAt: true } }),
  ]);
  return {
    count: agg._count, average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    items: items.map((r) => ({ name: publicName(r.name), rating: r.rating, text: r.text ?? "", date: r.createdAt.toISOString().slice(0, 10) })),
  };
}
