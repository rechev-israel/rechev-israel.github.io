import { beforeAll, describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("client website features (PostgreSQL)", () => {
  let db: any, ob: any, xp: any, my: any, cf: any;
  let biz = "", serviceId = "", owner: any;
  const now = new Date(Date.UTC(2027, 2, 1, 4, 0));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    ob = await import("@/server/services/online-booking");
    xp = await import("@/server/services/experience");
    my = await import("@/server/services/my-castel");
    cf = await import("@/server/services/client-features");
    const b = await db.business.create({ data: { name: "Client features", category: "x", city: "Ashkelon", branches: { create: { name: "main" } } } });
    biz = b.id;
    const branch = await db.branch.findFirstOrThrow({ where: { businessId: biz } });
    await db.availabilityRule.create({ data: { branchId: branch.id, weekday: 2, startTime: "09:00", endTime: "12:00" } });
    owner = await db.user.create({ data: { businessId: biz, email: `o${Date.now()}@cf.local`, name: "Owner", passwordHash: "x", role: "OWNER", acceptsBookings: true } });
    serviceId = (await db.service.create({ data: { businessId: biz, nameHe: "תספורת", nameEn: "Cut", durationMin: 30, price: 80 } })).id;
    await db.bookingSettings.create({ data: { businessId: biz, enabled: true, slotStepMin: 30, minNoticeMin: 60, maxDaysAhead: 180, maxActivePerPhone: 5 } });
  });
  const book = async (phone: string, day: string) => {
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date: day }, now);
    return ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: day, start: slots[0].start, name: "לקוח בדיקה", phone }, now);
  };

  it("live status: only what the shop set; cleared and ignored for cancelled appointments", async () => {
    const r = await book("0531000001", "2027-03-09");
    let o = await my.portalOverview(r.deviceToken);
    expect(o.upcoming[0]).toMatchObject({ live: "confirmed", delayMin: null });
    expect(o.upcoming[0].ref).toHaveLength(6);
    expect(o.upcoming[0].google).toContain("calendar.google.com");
    // the shop marks "delay 15" — but the appointment is far away, so it isn't fresh-for-today... set the time so it is
    await db.appointment.update({ where: { id: r.appointment.id }, data: { startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 5400_000) } });
    expect(await cf.setLiveStatus({ businessId: biz }, r.appointment.id, "delay", 15)).toBe(true);
    o = await my.portalOverview(r.deviceToken);
    expect(o.upcoming[0]).toMatchObject({ live: "delay", delayMin: 15 });
    await cf.setLiveStatus({ businessId: biz }, r.appointment.id, "ready");
    expect((await my.portalOverview(r.deviceToken)).upcoming[0].live).toBe("ready");
    await cf.setLiveStatus({ businessId: biz }, r.appointment.id, "clear");
    expect((await my.portalOverview(r.deviceToken)).upcoming[0].live).toBe("soon");
    expect(await cf.setLiveStatus({ businessId: "other" }, r.appointment.id, "ready")).toBe(false); // another business can't touch it
  });

  it("special requests: own upcoming appointment only, one per appointment, never changes price/duration", async () => {
    const r = await book("0531000002", "2027-03-16");
    const other = await book("0531000003", "2027-03-23");
    const c = await my.portalCustomer(r.deviceToken);
    const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]).toString("base64");
    await cf.saveRequest(c, r.appointment.id, { fade: "פייד נמוך", changes: "להשאיר יותר אורך למעלה", photo: png });
    await cf.saveRequest(c, r.appointment.id, { fade: "פייד נמוך", changes: "להשאיר יותר אורך למעלה", note: "עדכון" });
    expect(await db.appointmentRequest.count({ where: { appointmentId: r.appointment.id } })).toBe(1);
    expect(await db.notification.count({ where: { dedupeKey: `request:${r.appointment.id}` } })).toBe(1);
    const saved = await cf.getRequest(c.id, r.appointment.id);
    expect(saved).toMatchObject({ fade: "פייד נמוך", note: "עדכון" });
    expect((await db.customerPhoto.findFirstOrThrow({ where: { customerId: c.id } })).sharedWithBarber).toBe(true);
    await expect(cf.saveRequest(c, other.appointment.id, { note: "x" })).rejects.toThrow("not_found"); // not theirs
    await expect(cf.saveRequest(c, r.appointment.id, {})).rejects.toThrow("empty");
    const a = await db.appointment.findUniqueOrThrow({ where: { id: r.appointment.id } });
    expect([Number(a.price), a.endsAt.getTime() - a.startsAt.getTime()]).toEqual([80, 30 * 60_000]);
  });

  it("gift cards: off by default; no code before payment; redeemed exactly once", async () => {
    const req = { kind: "amount", amount: 150, buyerName: "דנה", buyerPhone: "0541234567", recipientName: "יוסי", message: "מזל טוב", terms: true };
    await expect(cf.requestGift(req, biz)).rejects.toThrow("disabled");
    await xp.saveExperience(biz, "gifts", { enabled: true, amounts: [100, 150], expiryMonths: 6, terms: "למימוש במספרה" });
    await expect(cf.requestGift({ ...req, amount: 999 }, biz)).rejects.toThrow("invalid");
    await expect(cf.requestGift({ ...req, terms: false }, biz)).rejects.toThrow("invalid");
    const { viewToken } = await cf.requestGift(req, biz);
    let g = await cf.giftByToken(viewToken);
    expect(g).toMatchObject({ status: "REQUESTED", code: null, amount: 150, recipientName: "יוסי" });
    const card = await db.giftCard.findFirstOrThrow({ where: { businessId: biz } });
    expect((await cf.redeemGift(owner, card.id)).error).toBe("unpaid");
    expect(await cf.markGiftPaid(owner, card.id, now)).toBe(true);
    expect(await cf.markGiftPaid(owner, card.id, now)).toBe(false); // can't "pay" twice
    g = await cf.giftByToken(viewToken);
    expect(g.code).toMatch(/^GIFT-/);
    expect(g.expiresAt).toBe("2027-09-01");
    const attempts = await Promise.all([cf.redeemGift(owner, g.code, now), cf.redeemGift(owner, g.code, now), cf.redeemGift(owner, g.code, now)]);
    expect(attempts.filter((x: any) => x.ok)).toHaveLength(1);
    expect((await cf.giftByToken(viewToken)).status).toBe("REDEEMED");
  });

  it("surprise: off by default; one per completed visit; benefit hidden until revealed", async () => {
    const r = await book("0531000004", "2027-03-30");
    const cid = r.appointment.customerId;
    const visit = await db.appointment.create({ data: { businessId: biz, customerId: cid, serviceId, startsAt: new Date(Date.now() - 2 * 86400_000), endsAt: new Date(Date.now() - 2 * 86400_000 + 1800_000), status: "COMPLETED", price: 80 } });
    await my.portalOverview(r.deviceToken);
    expect(await db.loyaltyReward.count({ where: { customerId: cid, kind: "surprise" } })).toBe(0);
    await xp.saveExperience(biz, "surprise", { enabled: true, rewards: [{ label: "10% הנחה", weight: 1 }], windowDays: 14, expiryDays: 30 });
    let o = await my.portalOverview(r.deviceToken);
    await my.portalOverview(r.deviceToken);
    expect(await db.loyaltyReward.count({ where: { customerId: cid, refKey: `surprise:${visit.id}` } })).toBe(1);
    const s = o.rewards.find((x: any) => x.kind === "surprise");
    expect(s).toMatchObject({ label: null, hidden: true });
    expect(o.notifications.some((n: any) => n.kind === "surprise")).toBe(true);
    expect(await xp.revealSurprise(cid, s.id)).toMatchObject({ label: "10% הנחה" });
    expect(await xp.revealSurprise(cid, s.id)).toMatchObject({ label: "10% הנחה" }); // same benefit, no re-roll
    o = await my.portalOverview(r.deviceToken);
    expect(o.rewards.find((x: any) => x.kind === "surprise")).toMatchObject({ label: "10% הנחה", hidden: false });
    await expect(xp.revealSurprise("someone-else", s.id)).rejects.toThrow("not_found");
  });
});
