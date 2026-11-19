import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { zonedParts } from "@/lib/dates";
import {
  clubProgress, fitsWindow, isReferralCode, makeReferralCode, parseClub, parseReferral, parseReminders, parseVip, qualifyingVisits, rewardText,
  type Club, type ReferralCfg, type Vip,
} from "@/domain/experience";
import { sendPush } from "@/server/notify/push";

/**
 * MY CASTEL — customer experience programs, built on the existing customers and appointments
 * (no second customer database). All programs are off until the owner turns them on.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const dayKeyOf = (d: Date) => { const p = zonedParts(d); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };
const DAY = 86400_000;

export async function getExperience(businessId: string) {
  const s = await db.experienceSettings.findUnique({ where: { businessId } });
  return { club: parseClub(s?.club), vip: parseVip(s?.vip), referral: parseReferral(s?.referral), reminders: parseReminders(s?.reminders) };
}
export type Experience = Awaited<ReturnType<typeof getExperience>>;

export async function saveExperience(businessId: string, section: "club" | "vip" | "referral" | "reminders", value: unknown) {
  const v = section === "club" ? parseClub(value) : section === "vip" ? parseVip(value) : section === "referral" ? parseReferral(value) : parseReminders(value);
  const data = { [section]: v as Prisma.InputJsonValue };
  await db.experienceSettings.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
  return v;
}

// ───────── CASTEL CLUB ─────────

async function visitRows(customerId: string) {
  const appts = await db.appointment.findMany({ where: { customerId, status: "COMPLETED" }, select: { status: true, startsAt: true, notes: true, service: { select: { premiumOnly: true } } } });
  return appts.map((a) => ({ status: a.status, dayKey: dayKeyOf(a.startsAt), premium: Boolean(a.service?.premiumOnly) || (a.notes ?? "").includes("תור פרימיום") }));
}

/** Issue the club rewards a customer has earned (each card once — refKey is unique) and expire old ones. */
export async function syncClub(businessId: string, customerId: string, club: Club, now = new Date()) {
  const visits = qualifyingVisits(await visitRows(customerId), club);
  const progress = clubProgress(visits, club.visitsRequired);
  if (club.enabled && progress.cycles > 0) {
    const label = rewardText(club, true);
    const expiresAt = club.expiryDays ? new Date(now.getTime() + club.expiryDays * DAY) : null;
    await db.loyaltyReward.createMany({
      data: Array.from({ length: progress.cycles }, (_, i) => ({ businessId, customerId, kind: "club", refKey: `club:${customerId}:${club.visitsRequired}:${i + 1}`, label, expiresAt })),
      skipDuplicates: true,
    });
  }
  await db.loyaltyReward.updateMany({ where: { customerId, status: "AVAILABLE", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
  return { visits, ...progress };
}

// ───────── CASTEL VIP ─────────

export async function syncVip(businessId: string, customerId: string, vip: Vip, visits: number) {
  if (!vip.enabled || !vip.autoEnabled || visits < vip.autoMinVisits) return;
  // Auto never re-activates someone the owner revoked.
  await db.vipMembership.createMany({ data: [{ businessId, customerId, source: "AUTO" }], skipDuplicates: true });
}
export async function isVip(customerId: string, vip: Vip) {
  if (!vip.enabled) return false;
  const m = await db.vipMembership.findUnique({ where: { customerId } });
  return m?.status === "ACTIVE";
}

// ───────── CASTEL FRIENDS ─────────

export async function ensureReferralCode(businessId: string, customerId: string) {
  const existing = await db.referralCode.findUnique({ where: { customerId } });
  if (existing) return existing.code;
  for (let i = 0; i < 6; i++) {
    try { return (await db.referralCode.create({ data: { businessId, customerId, code: makeReferralCode() } })).code; }
    catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
  }
  throw new Error("referral code collision");
}

/**
 * A new customer booked with a friend's link. Rules: program on; not themselves; a brand-new customer
 * (no earlier appointments); one referral per new customer; the referrer's limit.
 */
export async function recordReferral(code: unknown, appointment: { id: string; businessId: string; customerId: string | null }) {
  if (!isReferralCode(code) || !appointment.customerId) return { ok: false as const, reason: "invalid" };
  const cfg = (await getExperience(appointment.businessId)).referral;
  if (!cfg.enabled) return { ok: false as const, reason: "disabled" };
  const rc = await db.referralCode.findUnique({ where: { code } });
  if (!rc || rc.businessId !== appointment.businessId) return { ok: false as const, reason: "invalid" };
  if (rc.customerId === appointment.customerId) return { ok: false as const, reason: "self" };
  const earlier = await db.appointment.count({ where: { customerId: appointment.customerId, id: { not: appointment.id } } });
  if (earlier > 0) return { ok: false as const, reason: "not_new" };
  const count = await db.referral.count({ where: { referrerId: rc.customerId, status: { not: "REJECTED" } } });
  if (count >= cfg.maxPerCustomer) return { ok: false as const, reason: "limit" };
  try {
    await db.referral.create({ data: { businessId: appointment.businessId, referrerId: rc.customerId, referredId: appointment.customerId, appointmentId: appointment.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false as const, reason: "already" };
    throw e;
  }
  return { ok: true as const };
}

/** A referral qualifies after the friend's completed visits; rewards are issued once (unique refKey). */
export async function syncReferrals(businessId: string, customerId: string, cfg: ReferralCfg, now = new Date()) {
  const refs = await db.referral.findMany({ where: { businessId, status: "PENDING", OR: [{ referrerId: customerId }, { referredId: customerId }] } });
  for (const r of refs) {
    const done = await db.appointment.count({ where: { customerId: r.referredId, status: "COMPLETED" } });
    if (done < cfg.minCompleted) continue;
    await db.referral.update({ where: { id: r.id }, data: { status: "QUALIFIED", qualifiedAt: now } });
    if (!cfg.enabled) continue;
    const expiresAt = cfg.expiryDays ? new Date(now.getTime() + cfg.expiryDays * DAY) : null;
    const rows = [{ businessId, customerId: r.referrerId, kind: "referral", refKey: `ref:${r.id}:referrer`, label: cfg.referrerRewardLabel || "הטבת חבר מביא חבר", expiresAt }];
    if (cfg.bothBenefit) rows.push({ businessId, customerId: r.referredId, kind: "referral", refKey: `ref:${r.id}:friend`, label: cfg.friendRewardLabel || "הטבת הצטרפות", expiresAt });
    await db.loyaltyReward.createMany({ data: rows, skipDuplicates: true });
  }
}

/** Everything that changes with visits, refreshed when the customer or the owner looks. */
export async function syncCustomerPrograms(businessId: string, customerId: string, exp?: Experience) {
  const e = exp ?? (await getExperience(businessId));
  const club = await syncClub(businessId, customerId, e.club);
  await syncVip(businessId, customerId, e.vip, club.visits);
  await syncReferrals(businessId, customerId, e.referral);
  return { exp: e, club };
}

// ───────── MY HAIRCUT ─────────

const short = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || null : null);
export async function saveHaircutProfile(businessId: string, customerId: string, input: Record<string, unknown>) {
  const photoId = typeof input.photoId === "string" && input.photoId ? input.photoId : null;
  if (photoId && !(await db.customerPhoto.findFirst({ where: { id: photoId, customerId } }))) throw new Error("photo");
  const data = {
    style: short(input.style, 80), fade: short(input.fade, 60), guards: short(input.guards, 60), topLength: short(input.topLength, 60),
    beard: short(input.beard, 120), styling: short(input.styling, 120), notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 800) || null : null, photoId,
  };
  return db.haircutProfile.upsert({ where: { customerId }, create: { businessId, customerId, ...data }, update: data });
}

// ───────── MY LOOKS (private photos, stored in the database) ─────────

export const PHOTO_MAX_BYTES = 900_000;
export const PHOTO_MAX_COUNT = 40;
const MAGIC: [string, number[]][] = [["image/jpeg", [0xff, 0xd8, 0xff]], ["image/png", [0x89, 0x50, 0x4e, 0x47]], ["image/webp", [0x52, 0x49, 0x46, 0x46]]];

/** Accepts a data URL; checks the real file signature (not just the name), size and per-customer limit. */
export async function uploadPhoto(businessId: string, customerId: string, dataUrl: unknown, note?: unknown) {
  if (typeof dataUrl !== "string") throw new Error("invalid");
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("invalid");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > PHOTO_MAX_BYTES) throw new Error("too_big");
  const kind = MAGIC.find(([, sig]) => sig.every((b, i) => buf[i] === b));
  if (!kind || kind[0] !== m[1] || (kind[0] === "image/webp" && buf.subarray(8, 12).toString("ascii") !== "WEBP")) throw new Error("invalid");
  if ((await db.customerPhoto.count({ where: { customerId } })) >= PHOTO_MAX_COUNT) throw new Error("limit");
  return db.customerPhoto.create({ data: { businessId, customerId, mime: kind[0], data: buf, bytes: buf.length, note: short(note, 300) }, select: { id: true } });
}

export async function updatePhoto(customerId: string, id: unknown, input: { note?: unknown; favorite?: unknown; sharedWithBarber?: unknown }) {
  if (typeof id !== "string") throw new Error("not_found");
  const data: Prisma.CustomerPhotoUpdateManyMutationInput = {};
  if (input.note !== undefined) data.note = short(input.note, 300);
  if (typeof input.favorite === "boolean") data.favorite = input.favorite;
  if (typeof input.sharedWithBarber === "boolean") data.sharedWithBarber = input.sharedWithBarber;
  const r = await db.customerPhoto.updateMany({ where: { id, customerId }, data });
  if (!r.count) throw new Error("not_found");
}

export async function deletePhoto(customerId: string, id: unknown) {
  if (typeof id !== "string") throw new Error("not_found");
  const r = await db.customerPhoto.deleteMany({ where: { id, customerId } });
  if (!r.count) throw new Error("not_found");
  await db.haircutProfile.updateMany({ where: { customerId, photoId: id }, data: { photoId: null } });
}

// ───────── Waitlist ─────────

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export async function joinWaitlist(businessId: string, customerId: string, input: { serviceId?: unknown; dates?: unknown; fromMin?: unknown; toMin?: unknown; notify?: unknown }) {
  const today = dayKeyOf(new Date());
  const dates = Array.isArray(input.dates) ? [...new Set(input.dates.filter((d): d is string => typeof d === "string" && DATE.test(d) && d >= today))].slice(0, 5) : [];
  const fromMin = Number(input.fromMin), toMin = Number(input.toMin);
  if (!dates.length || !Number.isInteger(fromMin) || !Number.isInteger(toMin) || fromMin < 0 || toMin > 1440 || toMin <= fromMin) throw new Error("invalid");
  if (typeof input.serviceId !== "string") throw new Error("invalid");
  const service = await db.service.findFirst({ where: { id: input.serviceId, businessId, isActive: true, bookableOnline: true } });
  if (!service) throw new Error("invalid");
  if ((await db.waitlistEntry.count({ where: { customerId, status: { in: ["ACTIVE", "NOTIFIED"] } } })) >= 3) throw new Error("limit");
  return db.waitlistEntry.create({ data: { businessId, customerId, serviceId: service.id, dates, fromMin, toMin, notify: input.notify === "whatsapp" ? "whatsapp" : "portal" } });
}

export async function leaveWaitlist(customerId: string, id: unknown) {
  if (typeof id !== "string") throw new Error("not_found");
  const r = await db.waitlistEntry.updateMany({ where: { id, customerId, status: { in: ["ACTIVE", "NOTIFIED"] } }, data: { status: "LEFT" } });
  if (!r.count) throw new Error("not_found");
}

/** First free slot that matches an entry, checked against the live booking engine (never reserves anything). */
export async function findWaitlistMatch(businessId: string, e: { serviceId: string; dates: string[]; fromMin: number; toMin: number }, now = new Date()) {
  const { getSlots } = await import("./online-booking");
  const today = dayKeyOf(now);
  for (const date of e.dates) {
    if (date < today) continue;
    try {
      const { slots } = await getSlots(businessId, { serviceId: e.serviceId, staffId: "any", date }, now);
      // slot.start is a timestamp: compare its local time of day with the customer's range
      for (const x of slots) {
        const p = zonedParts(new Date(x.start)), min = p.hour * 60 + p.minute;
        if (fitsWindow(min, e.fromMin, e.toMin)) return { date, start: min, at: x.start, label: `${pad(p.hour)}:${pad(p.minute)}` };
      }
    } catch { /* closed / disabled: no match */ }
  }
  return null;
}

/**
 * Runs with the business heartbeat: expires past entries, marks booked ones, and when a matching time opens,
 * tells the customer (in MY CASTEL, and by WhatsApp only if they asked and the channel is really connected)
 * and the owner. VIP customers are handled first when the owner enabled VIP priority.
 */
export async function waitlistTick(businessId: string, now = new Date()) {
  const today = dayKeyOf(now);
  const entries = await db.waitlistEntry.findMany({ where: { businessId, status: { in: ["ACTIVE", "NOTIFIED"] } }, include: { customer: { select: { id: true, firstName: true, status: true, vipMembership: true } } }, orderBy: { createdAt: "asc" } });
  if (!entries.length) return 0;
  const exp = await getExperience(businessId);
  const prio = (x: (typeof entries)[number]) => (exp.vip.enabled && exp.vip.waitlistPriority && x.customer.vipMembership?.status === "ACTIVE" ? 0 : 1);
  entries.sort((a, b) => prio(a) - prio(b));
  let notified = 0;
  for (const e of entries) {
    if (e.dates.every((d) => d < today) || e.customer.status === "BLOCKED") { await db.waitlistEntry.update({ where: { id: e.id }, data: { status: "EXPIRED" } }); continue; }
    const booked = await db.appointment.findFirst({ where: { customerId: e.customerId, serviceId: e.serviceId, createdAt: { gt: e.createdAt }, status: { in: ["SCHEDULED", "CONFIRMED"] } } });
    if (booked) { await db.waitlistEntry.update({ where: { id: e.id }, data: { status: "BOOKED" } }); continue; }
    const match = await findWaitlistMatch(businessId, e, now);
    if (!match) { if (e.status === "NOTIFIED") await db.waitlistEntry.update({ where: { id: e.id }, data: { status: "ACTIVE", matchDate: null, matchStart: null } }); continue; }
    if (e.status === "NOTIFIED" && e.matchDate === match.date && e.matchStart === match.start) continue; // already told about this slot
    await db.waitlistEntry.update({ where: { id: e.id }, data: { status: "NOTIFIED", matchDate: match.date, matchStart: match.start, notifiedAt: now } });
    notified++;
    const [y, m, d] = match.date.split("-");
    const when = `${d}.${m} ${match.label}`;
    const title = `התפנה תור לרשימת ההמתנה: ${e.customer.firstName}`;
    await db.notification.create({ data: { businessId, kind: "waitlist", level: "info", title, body: `${when} · הלקוח יכול לקבוע ב־MY CASTEL`, link: `/crm/${e.customerId}`, entityId: e.id, dedupeKey: `waitlist:${e.id}:${match.date}:${match.start}` } }).catch(() => null);
    const owners = await db.user.findMany({ where: { businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { id: true } });
    await sendPush(businessId, owners.map((o) => o.id), { title, body: when, url: `/crm/${e.customerId}`, tag: `waitlist-${e.id}` }).catch(() => null);
    if (e.notify === "whatsapp") {
      const { draftMessage } = await import("@/server/comms/messages");
      await draftMessage({ businessId, channel: "WHATSAPP", customerId: e.customerId, purpose: "transactional", auto: true,
        body: `היי {{name}}, התפנה תור ב־CASTEL STUDIO שמתאים לרשימת ההמתנה שלך: ${when}. לקביעה מהירה נכנסים ל־MY CASTEL באתר. התור לא שמור עד שקובעים 🙏` }).catch((err) => logger.error("waitlist.message_failed", { err: String(err) }));
    }
  }
  return notified;
}

// ───────── Smart reminders ─────────

const REMINDER_BODY = {
  h24: "היי {{name}}, תזכורת לתור שלך מחר {{date}} בשעה {{time}} ב־CASTEL STUDIO ({{service}}). צריך לשנות? אפשר דרך MY CASTEL באתר.",
  h2: "היי {{name}}, נתראה היום בשעה {{time}} ב־CASTEL STUDIO ({{service}}) ✂️",
};

/**
 * 24h / 2h reminders through the existing messaging pipeline (consent checks included).
 * One per appointment, kind and start time — a moved appointment gets a new one, a cancelled one gets none.
 * When WhatsApp isn't connected the reminder is recorded as not sent (never claimed as delivered).
 */
export async function reminderTick(businessId: string, now = new Date()) {
  const cfg = (await getExperience(businessId)).reminders;
  if (!cfg.enabled) return 0;
  const { draftMessage } = await import("@/server/comms/messages");
  const kinds: ["h24" | "h2", number, number][] = [];
  if (cfg.h24) kinds.push(["h24", 24 * 3600_000, 3 * 3600_000]);
  if (cfg.h2) kinds.push(["h2", 2 * 3600_000, 15 * 60_000]);
  let made = 0;
  for (const [kind, lead, last] of kinds) {
    const appts = await db.appointment.findMany({
      where: { businessId, status: { in: ["SCHEDULED", "CONFIRMED"] }, customerId: { not: null }, startsAt: { gt: new Date(now.getTime() + last), lte: new Date(now.getTime() + lead) } },
      include: { service: true },
    });
    for (const a of appts) {
      if (a.createdAt.getTime() > a.startsAt.getTime() - lead) continue; // booked inside the window: they already know
      const key = { appointmentId: a.id, kind, startsAtKey: a.startsAt.toISOString() };
      if (await db.appointmentReminder.findUnique({ where: { appointmentId_kind_startsAtKey: key } })) continue;
      const p = zonedParts(a.startsAt);
      let outcome = "failed", messageId: string | null = null;
      try {
        const msg = await draftMessage({ businessId, channel: "WHATSAPP", customerId: a.customerId, purpose: "transactional", auto: true, body: REMINDER_BODY[kind],
          vars: { date: `${pad(p.day)}.${pad(p.month)}`, time: `${pad(p.hour)}:${pad(p.minute)}`, service: a.service?.nameHe ?? "" } });
        messageId = msg.id;
        outcome = msg.status === "SENT" ? "sent" : msg.status === "BLOCKED_NO_CONSENT" ? "blocked_no_consent" : msg.error === "auto_skipped_channel_not_connected" ? "skipped_not_connected" : msg.status === "PENDING_APPROVAL" ? "pending_approval" : msg.status === "APPROVED" ? "queued" : "failed";
      } catch (err) { logger.error("reminder.failed", { err: String(err), appointmentId: a.id }); }
      try { await db.appointmentReminder.create({ data: { businessId, ...key, outcome, messageId } }); made++; }
      catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
    }
  }
  return made;
}
