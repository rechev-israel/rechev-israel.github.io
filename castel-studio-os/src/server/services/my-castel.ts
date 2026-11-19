import { db } from "@/lib/db";
import { zonedDate, zonedParts } from "@/lib/dates";
import { icsEvent } from "@/domain/booking";
import { rewardText } from "@/domain/experience";
import { customerByDevice, customerOverview } from "./customer-portal";
import { ensureReferralCode, getExperience, syncCustomerPrograms } from "./experience";
import { ReviewError, saveReview, type ReviewInput } from "./reviews";

/**
 * MY CASTEL — the customer's private area. Every call is resolved from the device key that was issued
 * when the customer booked on this device (or opened their booking link), so a customer only ever
 * reaches their own records.
 */
export class PortalError extends Error {}
const pad = (n: number) => String(n).padStart(2, "0");
const SITE = "https://remarkable-sfogliatella-b3c7b4.netlify.app";

export async function portalCustomer(device: unknown) {
  const c = await customerByDevice(device);
  if (!c) throw new PortalError("unauthorized");
  return c;
}

export async function portalOverview(device: unknown) {
  const c = await portalCustomer(device);
  const base = await customerOverview(device);
  if (!base) throw new PortalError("unauthorized");
  const { exp, club } = await syncCustomerPrograms(c.businessId, c.id);
  const ids = [...base.upcoming, ...base.history].map((a) => a.id);
  const [apptMeta, reviews, rewards, vip, refCode, refs, profile, photos, waitlist, branch, services] = await Promise.all([
    db.appointment.findMany({ where: { id: { in: ids } }, select: { id: true, serviceId: true } }),
    db.review.findMany({ where: { appointmentId: { in: ids } }, select: { appointmentId: true, rating: true } }),
    db.loyaltyReward.findMany({ where: { customerId: c.id }, orderBy: { earnedAt: "desc" }, take: 30 }),
    db.vipMembership.findUnique({ where: { customerId: c.id } }),
    exp.referral.enabled ? ensureReferralCode(c.businessId, c.id) : Promise.resolve(null),
    db.referral.findMany({ where: { referrerId: c.id }, select: { status: true, createdAt: true } }),
    db.haircutProfile.findUnique({ where: { customerId: c.id } }),
    db.customerPhoto.findMany({ where: { customerId: c.id }, orderBy: { createdAt: "desc" }, select: { id: true, note: true, favorite: true, sharedWithBarber: true, createdAt: true } }),
    db.waitlistEntry.findMany({ where: { customerId: c.id, status: { in: ["ACTIVE", "NOTIFIED"] } }, orderBy: { createdAt: "desc" } }),
    db.branch.findFirst({ where: { businessId: c.businessId, isActive: true }, orderBy: { createdAt: "asc" }, select: { address: true, phone: true } }),
    db.service.findMany({ where: { businessId: c.businessId, isActive: true, bookableOnline: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }], select: { id: true, nameHe: true, nameEn: true, premiumOnly: true } }),
  ]);
  const svcOf = new Map(apptMeta.map((a) => [a.id, a.serviceId]));
  const ratingOf = new Map(reviews.map((r) => [r.appointmentId, r.rating]));
  const bookable = new Set(services.map((s) => s.id));
  const withMeta = <T extends { id: string; status: string }>(a: T) => {
    const serviceId = svcOf.get(a.id) ?? null;
    return { ...a, serviceId: serviceId && bookable.has(serviceId) ? serviceId : null, rating: ratingOf.get(a.id) ?? null, canReview: a.status === "COMPLETED" && !ratingOf.has(a.id) };
  };
  const place = branch?.address || "CASTEL STUDIO אשקלון";
  const vipActive = exp.vip.enabled && vip?.status === "ACTIVE";
  const now = Date.now();
  const at = (d: string, t: string) => { const [y, m, dd] = d.split("-").map(Number), [hh, mm] = t.split(":").map(Number); return zonedDate(y, m, dd, hh, mm).getTime(); };
  const soon = base.upcoming.filter((a) => at(a.date, a.time) - now < 26 * 3600_000);
  const available = rewards.filter((r) => r.status === "AVAILABLE");
  const notifications = [
    ...soon.map((a) => ({ kind: "reminder", id: a.id, date: a.date, time: a.time, service: a.service })),
    ...waitlist.filter((w) => w.status === "NOTIFIED" && w.matchDate).map((w) => ({ kind: "waitlist", id: w.id, date: w.matchDate!, time: `${pad(Math.floor(w.matchStart! / 60))}:${pad(w.matchStart! % 60)}`, serviceId: w.serviceId })),
    ...available.map((r) => ({ kind: "reward", id: r.id, label: r.label })),
    ...(vipActive && exp.vip.announcement ? [{ kind: "vip", id: "vip", text: exp.vip.announcement }] : []),
  ];
  return {
    ...base,
    upcoming: base.upcoming.map(withMeta),
    history: base.history.map(withMeta),
    shop: { phone: branch?.phone ?? null, address: place, waze: `https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`, maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` },
    club: exp.club.enabled ? { visits: club.visits, inCard: club.inCard, required: club.required, remaining: club.remaining, reward: rewardText(exp.club, true), rewardEn: rewardText(exp.club, false), conditions: exp.club.conditions, expiryDays: exp.club.expiryDays } : null,
    rewards: rewards.map((r) => ({ id: r.id, kind: r.kind, label: r.label, status: r.status, earnedAt: r.earnedAt.toISOString().slice(0, 10), expiresAt: r.expiresAt?.toISOString().slice(0, 10) ?? null, redeemedAt: r.redeemedAt?.toISOString().slice(0, 10) ?? null })),
    vip: exp.vip.enabled ? (vipActive ? { member: true, since: vip!.since.toISOString().slice(0, 10), benefits: exp.vip.benefits, announcement: exp.vip.announcement } : { member: false, autoMinVisits: exp.vip.autoEnabled ? exp.vip.autoMinVisits : null, visits: club.visits }) : null,
    referral: exp.referral.enabled && refCode ? {
      code: refCode, link: `${SITE}/?ref=${refCode}`, reward: exp.referral.referrerRewardLabel, friendReward: exp.referral.bothBenefit ? exp.referral.friendRewardLabel : "", conditions: exp.referral.conditions, minCompleted: exp.referral.minCompleted,
      invited: refs.length, qualified: refs.filter((r) => r.status === "QUALIFIED").length, pending: refs.filter((r) => r.status === "PENDING").length,
    } : null,
    haircut: profile ? { style: profile.style, fade: profile.fade, guards: profile.guards, topLength: profile.topLength, beard: profile.beard, styling: profile.styling, notes: profile.notes, photoId: profile.photoId, updatedAt: profile.updatedAt.toISOString().slice(0, 10) } : null,
    photos: photos.map((p) => ({ id: p.id, note: p.note, favorite: p.favorite, shared: p.sharedWithBarber, date: p.createdAt.toISOString().slice(0, 10) })),
    waitlist: waitlist.map((w) => ({ id: w.id, serviceId: w.serviceId, dates: w.dates, from: w.fromMin, to: w.toMin, notify: w.notify, status: w.status, match: w.status === "NOTIFIED" && w.matchDate ? { date: w.matchDate, time: `${pad(Math.floor(w.matchStart! / 60))}:${pad(w.matchStart! % 60)}` } : null })),
    services: services.map((s) => ({ id: s.id, he: s.nameHe, en: s.nameEn, premiumOnly: s.premiumOnly })),
    notifications,
  };
}

/**
 * CASTEL FRIENDS by phone number (the owner's choice, like "My appointments"): only the code, the link and
 * counts — nothing private. Sharing a code can only bring the code's owner a benefit.
 */
export async function referralByPhone(phone: unknown) {
  const { customerByPhone } = await import("./customer-portal");
  const c = await customerByPhone(phone);
  if (!c) throw new PortalError("not_found");
  const exp = await getExperience(c.businessId);
  if (!exp.referral.enabled) return { referral: null };
  const code = await ensureReferralCode(c.businessId, c.id);
  const refs = await db.referral.findMany({ where: { referrerId: c.id }, select: { status: true } });
  return { referral: {
    code, link: `${SITE}/?ref=${code}`, reward: exp.referral.referrerRewardLabel, friendReward: exp.referral.bothBenefit ? exp.referral.friendRewardLabel : "", conditions: exp.referral.conditions, minCompleted: exp.referral.minCompleted,
    invited: refs.length, qualified: refs.filter((r) => r.status === "QUALIFIED").length, pending: refs.filter((r) => r.status === "PENDING").length,
  } };
}

/** Calendar file for one of the customer's own upcoming appointments. */
export async function portalIcs(device: unknown, appointmentId: unknown) {
  const c = await portalCustomer(device);
  if (typeof appointmentId !== "string") throw new PortalError("not_found");
  const a = await db.appointment.findFirst({ where: { id: appointmentId, customerId: c.id, status: { in: ["SCHEDULED", "CONFIRMED"] } }, include: { service: true, staff: { select: { name: true } }, business: { select: { name: true, city: true } } } });
  if (!a) throw new PortalError("not_found");
  return icsEvent({ uid: a.id, start: a.startsAt, end: a.endsAt, title: `${a.service?.nameHe ?? "תור"} — ${a.business.name}`, location: a.business.city, description: a.staff ? `ספר: ${a.staff.name}` : undefined });
}

/** Feedback from MY CASTEL: only for the customer's own appointments, one per appointment (verified when completed). */
export async function portalReview(device: unknown, appointmentId: unknown, input: ReviewInput) {
  const c = await portalCustomer(device);
  if (typeof appointmentId !== "string") throw new ReviewError("not_found");
  const a = await db.appointment.findFirst({ where: { id: appointmentId, customerId: c.id }, include: { customer: { select: { firstName: true, lastName: true } } } });
  if (!a || a.status === "CANCELLED") throw new ReviewError("not_found");
  return saveReview(a, input);
}

export async function portalPhoto(device: unknown, id: unknown) {
  const c = await portalCustomer(device);
  if (typeof id !== "string") throw new PortalError("not_found");
  const p = await db.customerPhoto.findFirst({ where: { id, customerId: c.id }, select: { mime: true, data: true } });
  if (!p) throw new PortalError("not_found");
  return p;
}

export const dateLabel = (d: Date) => { const p = zonedParts(d); return `${pad(p.day)}.${pad(p.month)}.${p.year}`; };
export { getExperience };
