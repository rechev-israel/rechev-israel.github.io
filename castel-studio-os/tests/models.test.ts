import { beforeAll, describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("CASTEL MODEL EXPERIENCE — hair-model applications (PostgreSQL)", () => {
  let db: any, ob: any, xp: any, md: any;
  let biz = "", serviceId = "", owner: any, manager: any;
  const now = new Date(Date.UTC(2027, 2, 1, 4, 0)); // Mon 1 Mar 2027 06:00 Jerusalem
  const png = (n: number) => "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n]).toString("base64");
  const photos = { front: png(1), side: png(2), back: png(3) };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    ob = await import("@/server/services/online-booking");
    xp = await import("@/server/services/experience");
    md = await import("@/server/services/model-applications");
    const b = await db.business.create({ data: { name: "Models", category: "x", city: "Ashkelon", branches: { create: { name: "main" } } } });
    biz = b.id;
    const branch = await db.branch.findFirstOrThrow({ where: { businessId: biz } });
    for (const wd of [2, 3]) await db.availabilityRule.create({ data: { branchId: branch.id, weekday: wd, startTime: "09:00", endTime: "13:00" } });
    owner = await db.user.create({ data: { businessId: biz, email: `own${Date.now()}@m.local`, name: "Owner", passwordHash: "x", role: "OWNER", acceptsBookings: true } });
    manager = { id: "mgr", businessId: biz, role: "MANAGER" };
    serviceId = (await db.service.create({ data: { businessId: biz, nameHe: "תספורת", nameEn: "Cut", durationMin: 30, price: 80 } })).id;
    await db.bookingSettings.create({ data: { businessId: biz, enabled: true, slotStepMin: 30, minNoticeMin: 60, maxDaysAhead: 60, maxActivePerPhone: 5 } });
  });
  const input = (o: Record<string, unknown> = {}) => ({ name: "מודל ניסיון", phone: "0551000001", date: "2027-03-02", start: Date.UTC(2027, 2, 2, 7, 0), photos, consentTerms: true, consentPhotos: true, ...o }); // 09:00 Jerusalem

  it("off by default; when on, a hidden 120-minute ₪0 service exists and the regular booking flow never offers it", async () => {
    expect((await md.modelDays(biz, now)).enabled).toBe(false);
    await xp.saveExperience(biz, "model", { enabled: true, holdHours: 48 });
    const s = await md.ensureModelService(biz);
    expect([s.durationMin, Number(s.price), s.bookableOnline]).toEqual([120, 0, false]);
    await expect(ob.getSlots(biz, { serviceId: s.id, staffId: "any", date: "2027-03-02" }, now)).rejects.toMatchObject({ code: "service" });
    const slots = await md.modelSlots(biz, "2027-03-02", now);
    expect(slots.map((x: any) => x.label)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]); // only full two-hour windows (09–13)
  });

  it("rejects missing photos, missing consent and bad files", async () => {
    await expect(md.submitModelApplication(biz, input({ photos: { front: png(1), side: png(2) } }), now)).rejects.toThrow("photos");
    await expect(md.submitModelApplication(biz, input({ consentTerms: false }), now)).rejects.toThrow("terms");
    await expect(md.submitModelApplication(biz, input({ consentPhotos: false }), now)).rejects.toThrow("photo_consent");
    await expect(md.submitModelApplication(biz, input({ photos: { ...photos, back: "data:image/png;base64," + Buffer.from("<script>").toString("base64") } }), now)).rejects.toThrow("photo_invalid");
    expect(await db.modelApplication.count({ where: { businessId: biz } })).toBe(0);
    expect(await db.customerPhoto.count({ where: { businessId: biz } })).toBe(0); // nothing left behind
  });

  it("a valid application is PENDING with a two-hour hold, three photos and one owner notification", async () => {
    const r = await md.submitModelApplication(biz, input(), now);
    const a = await db.modelApplication.findFirstOrThrow({ where: { businessId: biz } });
    expect(a).toMatchObject({ status: "PENDING_APPROVAL", dayKey: "2027-03-02", activeDay: "2027-03-02" });
    expect([a.photoFrontId, a.photoSideId, a.photoBackId].every(Boolean)).toBe(true);
    expect(await db.timeOff.count({ where: { id: a.holdId } })).toBe(1);
    expect(await db.appointment.count({ where: { businessId: biz } })).toBe(0); // NOT an appointment
    expect(await db.notification.count({ where: { dedupeKey: `model:${a.id}` } })).toBe(1);
    expect(await md.modelByToken(r.token)).toMatchObject({ status: "PENDING_APPROVAL", time: "09:00", durationMin: 120 });
    // regular paid bookings keep working around the hold
    const reg = await ob.getSlots(biz, { serviceId, staffId: "any", date: "2027-03-02" }, now);
    expect(reg.slots.length).toBeGreaterThan(0);
    expect(reg.slots.every((s: any) => s.start >= Date.UTC(2027, 2, 2, 9, 0))).toBe(true); // 09:00–11:00 is held
  });

  it("one model per day: a second application for the same day is blocked, also when sent simultaneously", async () => {
    await expect(md.submitModelApplication(biz, input({ phone: "0551000002", start: Date.UTC(2027, 2, 2, 9, 0) }), now)).rejects.toThrow("day_taken");
    expect((await md.modelDays(biz, now)).days.find((x: any) => x.date === "2027-03-02").status).toBe("taken");
    // a fresh day, five people at once
    const day = "2027-03-03", start = Date.UTC(2027, 2, 3, 7, 0);
    const r = await Promise.allSettled([1, 2, 3, 4, 5].map((i) => md.submitModelApplication(biz, input({ phone: `055200000${i}`, date: day, start: start + (i % 2) * 3600_000 }), now)));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.modelApplication.count({ where: { businessId: biz, dayKey: day, activeDay: day } })).toBe(1);
  });

  it("only the owner approves; approval makes exactly one confirmed 120-minute ₪0 appointment and releases the hold", async () => {
    const a = await db.modelApplication.findFirstOrThrow({ where: { businessId: biz, dayKey: "2027-03-02" } });
    await expect(md.approveModel(manager, a.id)).rejects.toThrow("forbidden");
    const appt = await md.approveModel({ id: owner.id, businessId: biz, role: "OWNER" }, a.id);
    expect([appt.status, Number(appt.price), (appt.endsAt - appt.startsAt) / 60000]).toEqual(["CONFIRMED", 0, 120]);
    await expect(md.approveModel({ id: owner.id, businessId: biz, role: "OWNER" }, a.id)).rejects.toThrow("not_pending"); // no duplicate
    expect(await db.appointment.count({ where: { businessId: biz } })).toBe(1);
    expect(await db.timeOff.count({ where: { id: a.holdId } })).toBe(0);
    const after = await db.modelApplication.findUniqueOrThrow({ where: { id: a.id } });
    expect(after).toMatchObject({ status: "APPROVED", activeDay: "2027-03-02", appointmentId: appt.id }); // still holds the day
    expect(after.photoFrontId).toBeTruthy(); // original photos kept
  });

  it("rejection (with an alternative) releases the hold and the day", async () => {
    const a = await db.modelApplication.findFirstOrThrow({ where: { businessId: biz, dayKey: "2027-03-03", activeDay: "2027-03-03" } });
    await md.rejectModel({ id: owner.id, businessId: biz, role: "OWNER" }, a.id, { reason: "השיער קצר מדי כרגע", altStartsAt: new Date(Date.UTC(2027, 2, 9, 7, 0)) });
    const r = await db.modelApplication.findUniqueOrThrow({ where: { id: a.id } });
    expect(r).toMatchObject({ status: "ALT_PROPOSED", activeDay: null, holdId: null, rejectReason: "השיער קצר מדי כרגע" });
    expect(await db.timeOff.count({ where: { businessId: biz, reason: { contains: "מודליסט" } } })).toBe(0);
    expect((await md.modelDays(biz, now)).days.find((x: any) => x.date === "2027-03-03").status).toBe("open");
  });

  it("unanswered requests expire and free their day; a cancelled model appointment frees it too", async () => {
    const r = await md.submitModelApplication(biz, input({ phone: "0553000001", date: "2027-03-09", start: Date.UTC(2027, 2, 9, 7, 0) }), now);
    await md.modelTick(biz, new Date(now.getTime() + 49 * 3600_000));
    expect(await md.modelByToken(r.token)).toMatchObject({ status: "EXPIRED" });
    expect((await md.modelDays(biz, now)).days.find((x: any) => x.date === "2027-03-09").status).toBe("open");
    const approved = await db.modelApplication.findFirstOrThrow({ where: { businessId: biz, status: "APPROVED" } });
    await db.appointment.update({ where: { id: approved.appointmentId }, data: { status: "CANCELLED" } });
    await md.modelTick(biz, now);
    expect(await db.modelApplication.findUniqueOrThrow({ where: { id: approved.id } })).toMatchObject({ status: "CANCELLED", activeDay: null });
  });

  it("disabled dates are closed for models only", async () => {
    await xp.saveExperience(biz, "model", { enabled: true, holdHours: 48, disabledDates: ["2027-03-10"] });
    await expect(md.modelSlots(biz, "2027-03-10", now)).rejects.toThrow("day_closed");
    expect((await ob.getSlots(biz, { serviceId, staffId: "any", date: "2027-03-10" }, now)).slots.length).toBeGreaterThan(0);
  });
});
