import { beforeAll, describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("MY CASTEL / customer experience (PostgreSQL)", () => {
  let db: any, ob: any, xp: any, my: any;
  let biz = "", serviceId = "";
  const now = new Date(Date.UTC(2027, 2, 1, 4, 0)); // Mon 1 Mar 2027 06:00 Jerusalem
  const date = "2027-03-02"; // Tuesday 09:00–12:00

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    ob = await import("@/server/services/online-booking");
    xp = await import("@/server/services/experience");
    my = await import("@/server/services/my-castel");
    const b = await db.business.create({ data: { name: "Experience", category: "x", city: "Ashkelon", branches: { create: { name: "main", address: "הרצל 1, אשקלון" } } } });
    biz = b.id;
    const branch = await db.branch.findFirstOrThrow({ where: { businessId: biz } });
    await db.availabilityRule.create({ data: { branchId: branch.id, weekday: 2, startTime: "09:00", endTime: "12:00" } });
    await db.user.create({ data: { businessId: biz, email: `x${Date.now()}@exp.local`, name: "Barber", passwordHash: "x", role: "OWNER", acceptsBookings: true } });
    serviceId = (await db.service.create({ data: { businessId: biz, nameHe: "תספורת", nameEn: "Cut", durationMin: 30, price: 80 } })).id;
    await db.bookingSettings.create({ data: { businessId: biz, enabled: true, slotStepMin: 30, minNoticeMin: 60, maxDaysAhead: 180, maxActivePerPhone: 5 } });
  });

  const book = async (phone: string, start?: number, day = date) => {
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date: day }, now);
    return ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: day, start: start ?? slots[0].start, name: "לקוח ניסיון", phone }, now);
  };
  const completedVisit = (customerId: string, daysAgo: number, status = "COMPLETED") => db.appointment.create({
    data: { businessId: biz, customerId, serviceId, startsAt: new Date(now.getTime() - daysAgo * 86400_000), endsAt: new Date(now.getTime() - daysAgo * 86400_000 + 1800_000), status, price: 80 },
  });

  it("everything is off by default: no rewards, no VIP, no referral code, no reminders", async () => {
    const e = await xp.getExperience(biz);
    expect([e.club.enabled, e.vip.enabled, e.referral.enabled, e.reminders.enabled]).toEqual([false, false, false, false]);
    const r = await book("0521000001");
    const o = await my.portalOverview(r.deviceToken);
    expect(o.club).toBeNull();
    expect(o.vip).toBeNull();
    expect(o.referral).toBeNull();
    expect(await db.referralCode.count({ where: { businessId: biz } })).toBe(0);
  });

  it("the portal only opens with a real device key, and only shows that customer's data", async () => {
    await expect(my.portalOverview("x".repeat(43))).rejects.toThrow("unauthorized");
    const a = await book("0521000002", undefined, "2027-03-09");
    const b = await book("0521000003", undefined, "2027-03-16");
    const oa = await my.portalOverview(a.deviceToken);
    expect(oa.upcoming.map((x: any) => x.id)).toEqual([a.appointment.id]);
    expect(oa.upcoming.map((x: any) => x.id)).not.toContain(b.appointment.id);
    expect(oa.shop.waze).toContain("waze.com");
    expect(await my.portalIcs(a.deviceToken, a.appointment.id)).toContain("BEGIN:VEVENT");
    await expect(my.portalIcs(a.deviceToken, b.appointment.id)).rejects.toThrow("not_found"); // someone else's appointment
  });

  it("CASTEL CLUB: completed visits only, one per day, rewards issued once, owner can redeem", async () => {
    await xp.saveExperience(biz, "club", { enabled: true, visitsRequired: 3, rewardType: "discount_percent", rewardValue: 50 });
    const r = await book("0521000004", undefined, "2027-03-23");
    const cid = r.appointment.customerId;
    await completedVisit(cid, 30); await completedVisit(cid, 20);
    await completedVisit(cid, 20.01); // same day → doesn't count twice
    await completedVisit(cid, 10, "CANCELLED"); await completedVisit(cid, 9, "NO_SHOW");
    let o = await my.portalOverview(r.deviceToken);
    expect(o.club).toMatchObject({ visits: 2, inCard: 2, remaining: 1 });
    expect(o.rewards).toHaveLength(0);
    await completedVisit(cid, 5);
    o = await my.portalOverview(r.deviceToken);
    await my.portalOverview(r.deviceToken); // looking twice never doubles a reward
    expect(o.club).toMatchObject({ visits: 3, inCard: 0 });
    expect(await db.loyaltyReward.count({ where: { customerId: cid } })).toBe(1);
    expect(o.rewards[0]).toMatchObject({ status: "AVAILABLE", label: "50% הנחה על תספורת" });
  });

  it("CASTEL VIP: automatic only when the owner enables it; a revoked member stays revoked", async () => {
    const r = await book("0521000005", undefined, "2027-03-30");
    const cid = r.appointment.customerId;
    for (const n of [40, 41, 42]) await completedVisit(cid, n);
    await xp.saveExperience(biz, "vip", { enabled: true, autoEnabled: false, benefits: ["עדיפות ברשימת המתנה"] });
    expect((await my.portalOverview(r.deviceToken)).vip).toMatchObject({ member: false });
    await xp.saveExperience(biz, "vip", { enabled: true, autoEnabled: true, autoMinVisits: 3, benefits: ["עדיפות ברשימת המתנה"], announcement: "ערב VIP" });
    expect((await my.portalOverview(r.deviceToken)).vip).toMatchObject({ member: true, benefits: ["עדיפות ברשימת המתנה"] });
    await db.vipMembership.update({ where: { customerId: cid }, data: { status: "REVOKED" } });
    expect((await my.portalOverview(r.deviceToken)).vip).toMatchObject({ member: false });
  });

  it("CASTEL FRIENDS: no self-referral, only brand-new customers, once each, rewards after the friend's visit", async () => {
    await xp.saveExperience(biz, "referral", { enabled: true, referrerRewardLabel: "תספורת ב־50%", friendRewardLabel: "10% הנחה", bothBenefit: true, minCompleted: 1 });
    const ref = await book("0521000006", undefined, "2027-04-06");
    const code = (await my.portalOverview(ref.deviceToken)).referral.code;
    expect(code).toMatch(/^CS-/);
    expect(await xp.recordReferral(code, ref.appointment)).toMatchObject({ reason: "self" });
    const old = await book("0521000002", undefined, "2027-04-13"); // existing customer (booked before)
    expect(await xp.recordReferral(code, old.appointment)).toMatchObject({ reason: "not_new" });
    const friend = await book("0521000007", undefined, "2027-04-20");
    expect(await xp.recordReferral(code, friend.appointment)).toMatchObject({ ok: true });
    expect(await xp.recordReferral(code, friend.appointment)).toMatchObject({ reason: "already" });
    expect((await my.portalOverview(ref.deviceToken)).referral).toMatchObject({ invited: 1, pending: 1, qualified: 0 });
    await db.appointment.update({ where: { id: friend.appointment.id }, data: { status: "COMPLETED" } });
    const o = await my.portalOverview(ref.deviceToken);
    expect(o.referral).toMatchObject({ qualified: 1, pending: 0 });
    expect(o.rewards.some((x: any) => x.kind === "referral" && x.label === "תספורת ב־50%")).toBe(true);
    await my.portalOverview(friend.deviceToken);
    expect(await db.loyaltyReward.count({ where: { businessId: biz, refKey: { startsWith: "ref:" } } })).toBe(2); // referrer + friend, once
  });

  it("MY HAIRCUT + MY LOOKS: own profile, real image files only, private by default", async () => {
    const r = await book("0521000008", undefined, "2027-04-27");
    const c = await my.portalCustomer(r.deviceToken);
    const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");
    const { id } = await xp.uploadPhoto(biz, c.id, png, "פייד גבוה");
    await expect(xp.uploadPhoto(biz, c.id, "data:image/png;base64," + Buffer.from("<script>").toString("base64"))).rejects.toThrow("invalid");
    await xp.saveHaircutProfile(biz, c.id, { style: "קרופ", fade: "סקין פייד", guards: "0 בצדדים, 3 למעלה", photoId: id });
    const o = await my.portalOverview(r.deviceToken);
    expect(o.haircut).toMatchObject({ style: "קרופ", photoId: id });
    expect(o.photos[0]).toMatchObject({ id, shared: false });
    const other = await book("0521000009", undefined, "2027-05-04");
    await expect(my.portalPhoto(other.deviceToken, id)).rejects.toThrow("not_found"); // another customer can't open it
    expect((await my.portalPhoto(r.deviceToken, id)).mime).toBe("image/png");
    await xp.deletePhoto(c.id, id);
    expect((await my.portalOverview(r.deviceToken)).haircut.photoId).toBeNull();
  });

  it("waitlist: tells the customer and the owner when a matching time opens, never books by itself", async () => {
    // Fill Tuesday 2027-05-11 completely, then a customer waits for 10:00–12:00.
    const day = "2027-05-11";
    const taken = [];
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date: day }, now);
    for (const [i, s] of slots.entries()) taken.push(await ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: day, start: s.start, name: "מלא", phone: `05220000${10 + i}` }, now));
    const w = await book("0521000010", undefined, "2027-05-18");
    const c = await my.portalCustomer(w.deviceToken);
    await xp.joinWaitlist(biz, c.id, { serviceId, dates: [day], fromMin: 600, toMin: 720, notify: "portal" });
    expect(await xp.waitlistTick(biz, now)).toBe(0); // nothing free yet
    await db.appointment.update({ where: { id: taken[0].appointment.id }, data: { status: "CANCELLED" } }); // 09:00 frees up — outside the range
    expect(await xp.waitlistTick(biz, now)).toBe(0);
    await db.appointment.update({ where: { id: taken[3].appointment.id }, data: { status: "CANCELLED" } }); // 10:30 frees up
    expect(await xp.waitlistTick(biz, now)).toBe(1);
    expect(await xp.waitlistTick(biz, now)).toBe(0); // told once per opening
    const o = await my.portalOverview(w.deviceToken);
    expect(o.waitlist[0]).toMatchObject({ status: "NOTIFIED", match: { date: day, time: "10:30" } });
    expect(o.notifications.some((n: any) => n.kind === "waitlist")).toBe(true);
    expect(await db.notification.count({ where: { businessId: biz, kind: "waitlist" } })).toBe(1);
    expect(await db.appointment.count({ where: { customerId: c.id } })).toBe(1); // nothing was booked for them
  });

  it("reminders: off by default; when on, one per appointment and never claimed as sent without a provider", async () => {
    const r = await book("0521000011", undefined, "2027-05-25");
    const before = new Date(r.appointment.startsAt.getTime() - 20 * 3600_000);
    expect(await xp.reminderTick(biz, before)).toBe(0);
    await xp.saveExperience(biz, "reminders", { enabled: true, h24: true, h2: true });
    expect(await xp.reminderTick(biz, before)).toBe(1);
    expect(await xp.reminderTick(biz, before)).toBe(0); // no duplicates
    const rem = await db.appointmentReminder.findFirstOrThrow({ where: { appointmentId: r.appointment.id } });
    expect(rem.outcome).not.toBe("sent"); // WhatsApp isn't connected in tests
    await db.appointment.update({ where: { id: r.appointment.id }, data: { status: "CANCELLED" } });
    expect(await xp.reminderTick(biz, new Date(r.appointment.startsAt.getTime() - 90 * 60_000))).toBe(0); // cancelled → no 2h reminder
  });

  it("feedback: own appointments only; verified after a completed visit; private notes and consent kept", async () => {
    const r = await book("0521000012", undefined, "2027-06-01");
    const other = await book("0521000013", undefined, "2027-06-08");
    await expect(my.portalReview(r.deviceToken, other.appointment.id, { rating: 5 })).rejects.toThrow("not_found");
    await db.appointment.update({ where: { id: r.appointment.id }, data: { status: "COMPLETED" } });
    await my.portalReview(r.deviceToken, r.appointment.id, { rating: 4, serviceRating: 5, suggestion: "מוזיקה שקטה יותר", publicConsent: false });
    const rv = await db.review.findUniqueOrThrow({ where: { appointmentId: r.appointment.id } });
    expect(rv).toMatchObject({ verified: true, serviceRating: 5, suggestion: "מוזיקה שקטה יותר", publicConsent: false });
    const { publicReviews } = await import("@/server/services/reviews");
    expect((await publicReviews(biz)).count).toBe(0); // no consent → not on the website
  });
});
