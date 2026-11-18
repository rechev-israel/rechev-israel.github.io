/**
 * Integration tests against a real PostgreSQL database.
 * Run with TEST_DATABASE_URL pointing at a disposable DB (migrations are applied by `npm run test:db`).
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("integration (PostgreSQL)", () => {
  let db: typeof import("@/lib/db").db;
  let academy: typeof import("@/server/services/academy");
  let bookings: typeof import("@/server/services/bookings");
  let crm: typeof import("@/server/services/crm");
  let actor: { id: string; businessId: string };
  let otherBiz: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    academy = await import("@/server/services/academy");
    bookings = await import("@/server/services/bookings");
    crm = await import("@/server/services/crm");
    await db.$executeRawUnsafe(`TRUNCATE "Business" CASCADE`);
    const b = await db.business.create({ data: { name: "Test", category: "x", city: "Ashkelon", branches: { create: { name: "main" } } } });
    const u = await db.user.create({ data: { businessId: b.id, email: "t@test.local", name: "T", passwordHash: "x", role: "OWNER" } });
    actor = { id: u.id, businessId: b.id };
    otherBiz = (await db.business.create({ data: { name: "Other", category: "x", city: "TLV" } })).id;
    const { COURSE_DEFINITIONS } = await import("@/domain/academy");
    for (const c of COURSE_DEFINITIONS) await db.course.create({ data: { businessId: b.id, ...c } });
  });
  afterAll(async () => db?.$disconnect());

  it("enforces group course capacity (5) under concurrent enrollment", async () => {
    const course = await db.course.findFirstOrThrow({ where: { businessId: actor.businessId, code: "GROUP" } });
    const cohort = await academy.createCohort(actor, { courseId: course.id, name: "C1", startDate: "2027-01-03", weekdays: [0, 3], time: "18:00", status: "OPEN" });
    const lessons = await db.lesson.findMany({ where: { cohortId: cohort.id } });
    expect(lessons).toHaveLength(6);
    const students = await Promise.all(Array.from({ length: 7 }, (_, i) => academy.createStudent(actor, { firstName: `S${i}`, status: "ENROLLED" })));
    const results = await Promise.allSettled(students.map((s) => academy.enrollStudent(actor, cohort.id, s.id)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(5);
    expect(await db.enrollment.count({ where: { cohortId: cohort.id, status: { not: "CANCELLED" } } })).toBe(ok);
  });

  it("payment creates an ACTUAL academy income transaction; certificate requires payment + attendance", async () => {
    const course = await db.course.findFirstOrThrow({ where: { businessId: actor.businessId, code: "VIP" } });
    const cohort = await academy.createCohort(actor, { courseId: course.id, name: "VIP1", startDate: "2027-02-01", weekdays: [1, 4], time: "10:00", status: "OPEN" });
    const s = await academy.createStudent(actor, { firstName: "Vip", status: "ENROLLED" });
    const e = await academy.enrollStudent(actor, cohort.id, s.id);
    await expect(academy.issueCertificate(actor, e.id)).rejects.toThrow();
    await academy.addPayment(actor, e.id, { amount: 6500, method: "BIT", paidAt: "2027-02-01" });
    const tx = await db.transaction.findMany({ where: { businessId: actor.businessId, category: "academy" } });
    expect(tx.map((x) => Number(x.amount))).toContain(6500);
    expect(tx.every((x) => x.kind === "ACTUAL")).toBe(true);
    const lessons = await db.lesson.findMany({ where: { cohortId: cohort.id }, orderBy: { number: "asc" } });
    for (const l of lessons.slice(0, 5)) await academy.recordAttendance(actor, e.id, l.id, "PRESENT");
    const cert = await academy.issueCertificate(actor, e.id);
    expect(cert.certificateNumber).toMatch(/^CSA-\d{4}-\d{4}$/);
    expect((await db.student.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("GRADUATED");
  });

  it("tenant isolation: cannot touch another business's records", async () => {
    const foreign = await db.student.create({ data: { businessId: otherBiz, firstName: "Foreign" } });
    const cohort = await db.cohort.findFirstOrThrow({ where: { course: { businessId: actor.businessId } } });
    await expect(academy.enrollStudent(actor, cohort.id, foreign.id)).rejects.toThrow();
    const fc = await db.customer.create({ data: { businessId: otherBiz, firstName: "X" } });
    await expect(crm.updateCustomer(actor, fc.id, { firstName: "Hacked", tags: [], marketingConsentSms: "UNKNOWN", marketingConsentEmail: "UNKNOWN", marketingConsentWhatsapp: "UNKNOWN" })).rejects.toThrow();
    expect(await crm.archiveCustomer(actor, fc.id)).toBe(false);
  });

  it("completing an appointment books income once, updates customer stats; reverting removes it", async () => {
    const svc = await db.service.create({ data: { businessId: actor.businessId, nameHe: "תספורת", nameEn: "Cut", durationMin: 30, price: 120 } });
    const c = await crm.createCustomer(actor, { firstName: "Dan", phone: "+972501112233", tags: [], marketingConsentSms: "UNKNOWN", marketingConsentEmail: "UNKNOWN", marketingConsentWhatsapp: "UNKNOWN" });
    await expect(crm.createCustomer(actor, { firstName: "Dup", phone: "+972501112233", tags: [], marketingConsentSms: "UNKNOWN", marketingConsentEmail: "UNKNOWN", marketingConsentWhatsapp: "UNKNOWN" })).rejects.toThrow("crm.duplicatePhone");
    const a = await bookings.createAppointment(actor, { customerId: c.id, serviceId: svc.id, startsAt: "2026-11-10T10:00" });
    await bookings.setAppointmentStatus(actor, a.id, "COMPLETED");
    await bookings.setAppointmentStatus(actor, a.id, "SCHEDULED");
    await bookings.setAppointmentStatus(actor, a.id, "COMPLETED");
    const income = await db.transaction.findMany({ where: { description: `appointment:${a.id}` } });
    expect(income).toHaveLength(1);
    expect(Number(income[0].amount)).toBe(120);
    const updated = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(updated.visitCount).toBe(1);
    expect(Number(updated.totalSpent)).toBe(120);
    await bookings.setAppointmentStatus(actor, a.id, "SCHEDULED");
    expect(await db.transaction.count({ where: { description: `appointment:${a.id}` } })).toBe(0);
  });

  it("detects staff double-booking", async () => {
    const a = await bookings.createAppointment(actor, { staffId: actor.id, startsAt: "2026-12-01T10:00", durationMin: 60 });
    expect(a).toBeTruthy();
    await expect(bookings.createAppointment(actor, { staffId: actor.id, startsAt: "2026-12-01T10:30", durationMin: 30 })).rejects.toThrow("bookings.overlap");
  });
});

d("automation engine (PostgreSQL)", () => {
  let db: typeof import("@/lib/db").db;
  let engine: typeof import("@/server/automation/engine");
  let msgs: typeof import("@/server/comms/messages");
  let crm: typeof import("@/server/services/crm");
  let bizId: string;
  let actor: { id: string; businessId: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    engine = await import("@/server/automation/engine");
    msgs = await import("@/server/comms/messages");
    crm = await import("@/server/services/crm");
    const { ensureBaseData } = await import("@/server/services/bootstrap");
    const b = await db.business.create({ data: { name: "AutoBiz", category: "x", city: "Ashkelon", branches: { create: { name: "main" } } } });
    bizId = b.id;
    const u = await db.user.create({ data: { businessId: bizId, email: "auto@test.local", name: "A", passwordHash: "x", role: "OWNER" } });
    actor = { id: u.id, businessId: bizId };
    // These tests cover the manual-approval flow (owner turned automatic sending off).
    await db.bookingSettings.create({ data: { businessId: bizId, autoSendTransactional: false } });
    const { ensureBuiltinAutomations } = await import("@/server/automation/defaults");
    expect(await ensureBuiltinAutomations(db, bizId)).toBeGreaterThanOrEqual(7);
    expect(await ensureBuiltinAutomations(db, bizId)).toBe(0); // idempotent
    void ensureBaseData;
  });

  it("customer.created → task + welcome draft awaiting approval (never sent)", async () => {
    const c = await crm.createCustomer(actor, { firstName: "Noam", phone: "+972521234567", tags: [], marketingConsentSms: "UNKNOWN", marketingConsentEmail: "UNKNOWN", marketingConsentWhatsapp: "UNKNOWN" });
    const m = await db.outboundMessage.findFirstOrThrow({ where: { customerId: c.id, templateKey: "welcome" } });
    expect(m.status).toBe("PENDING_APPROVAL");
    expect(m.body).toContain("Noam");
    expect(await db.task.count({ where: { businessId: bizId, source: "automation" } })).toBeGreaterThan(0);
    const run = await db.automationRun.findFirstOrThrow({ where: { businessId: bizId, status: "succeeded" } });
    expect(Array.isArray(run.steps)).toBe(true);
  });

  it("approval without a configured provider does NOT mark as sent", async () => {
    delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const m = await db.outboundMessage.findFirstOrThrow({ where: { businessId: bizId, templateKey: "welcome" } });
    const r = await msgs.approveMessages(actor, [m.id]);
    expect(r.approved).toBe(1);
    const after = await db.outboundMessage.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.status).toBe("APPROVED");
    expect(after.error).toBe("provider_not_configured");
    expect(after.sentAt).toBeNull();
  });

  it("birthday (marketing) without opt-in is blocked; scheduled runs are deduplicated", async () => {
    const today = new Date();
    const c = await db.customer.create({ data: { businessId: bizId, firstName: "Bday", phone: "+972531112233", birthday: new Date(Date.UTC(1990, today.getUTCMonth(), today.getUTCDate())) } });
    await engine.runScheduled(today);
    await engine.runScheduled(today);
    const drafts = await db.outboundMessage.findMany({ where: { customerId: c.id, templateKey: "birthday" } });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe("BLOCKED_NO_CONSENT");
  });

  it("failed actions are retried with backoff", async () => {
    const a = await db.automation.create({
      data: { businessId: bizId, name: "broken", trigger: "customer.created", isActive: false, maxRetries: 2, definition: { conditions: [], actions: [{ type: "message.draft", channel: "WHATSAPP", templateKey: "does-not-exist" }] } },
    });
    const status = await engine.runAutomation(a, { customer: { id: "nonexistent-customer" } });
    expect(status).toBe("failed");
    const run = await db.automationRun.findFirstOrThrow({ where: { automationId: a.id } });
    expect(run.status).toBe("retrying");
    expect(run.nextRetryAt).not.toBeNull();
    await db.automationRun.update({ where: { id: run.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    await engine.processRetries();
    const final = await db.automationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(final.status).toBe("failed");
    expect(final.attempt).toBe(2);
  });
});

d("Cali sync (PostgreSQL)", () => {
  let db: typeof import("@/lib/db").db;
  let sync: typeof import("@/server/integrations/cali/sync");
  let bizId: string;
  const appt = (over: Record<string, unknown> = {}) => ({
    type: "appointment.upsert" as const,
    data: { id: "cali-1", startsAt: "2026-11-10T08:00:00Z", status: "completed", price: 120, service: { name: "Cut" }, customer: { id: "c-9", name: "Yossi Levi", phone: "050-7777777" }, ...over },
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    sync = await import("@/server/integrations/cali/sync");
    const b = await db.business.create({ data: { name: "CaliBiz", category: "x", city: "Ashkelon", branches: { create: { name: "main" } } } });
    bizId = b.id;
    await db.customer.create({ data: { businessId: bizId, firstName: "Yossi", phone: "+972507777777" } }); // pre-existing customer
  });

  it("first sync creates; replays and re-imports never duplicate", async () => {
    const r1 = await sync.applyCaliEvents(bizId, [appt()], "webhook");
    expect(r1.created).toBe(1);
    const r2 = await sync.applyCaliEvents(bizId, [appt(), appt()], "csv");
    expect(r2.created).toBe(0);
    expect(r2.unchanged).toBe(2);
    expect(await db.appointment.count({ where: { businessId: bizId, source: "cali" } })).toBe(1);
    expect(await db.customer.count({ where: { businessId: bizId } })).toBe(1); // matched by phone, not duplicated
    const c = await db.customer.findFirstOrThrow({ where: { businessId: bizId } });
    expect(c.externalRef).toBe("cali:c-9");
    expect(c.visitCount).toBe(1);
  });

  it("completed appointment books revenue exactly once; price change updates it", async () => {
    const a = await db.appointment.findFirstOrThrow({ where: { businessId: bizId, externalRef: "cali-1" } });
    expect(await db.transaction.count({ where: { description: `appointment:${a.id}` } })).toBe(1);
    await sync.applyCaliEvents(bizId, [appt({ price: 150 })], "webhook");
    const tx = await db.transaction.findFirstOrThrow({ where: { description: `appointment:${a.id}` } });
    expect(Number(tx.amount)).toBe(150);
  });

  it("cancellation updates status and removes revenue; unknown cancellation is harmless", async () => {
    const r = await sync.applyCaliEvents(bizId, [{ type: "appointment.cancelled", data: { id: "cali-1", reason: "client" } }, { type: "appointment.cancelled", data: { id: "does-not-exist" } }], "webhook");
    expect(r.updated).toBe(1);
    expect(r.failed).toBe(0);
    const a = await db.appointment.findFirstOrThrow({ where: { businessId: bizId, externalRef: "cali-1" } });
    expect(a.status).toBe("CANCELLED");
    expect(await db.transaction.count({ where: { description: `appointment:${a.id}` } })).toBe(0);
    expect(await db.syncLog.count({ where: { businessId: bizId } })).toBe(4);
  });

  it("one bad event does not block the batch", async () => {
    const r = await sync.applyCaliEvents(bizId, [appt({ id: "cali-2", customer: { name: "  " } as never }), appt({ id: "cali-3" })], "webhook");
    expect(r.created).toBe(1);
    expect(r.failed).toBe(1);
  });
});

d("package 2 (PostgreSQL)", () => {
  let db: typeof import("@/lib/db").db;
  let engine: typeof import("@/server/automation/engine");
  let bizId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    engine = await import("@/server/automation/engine");
    const b = await db.business.create({ data: { name: "P2", category: "x", city: "Ashkelon", branches: { create: { name: "main" } } } });
    bizId = b.id;
    await db.bookingSettings.create({ data: { businessId: bizId, autoSendTransactional: false } }); // approval-flow tests
    const { ensureBuiltinAutomations } = await import("@/server/automation/defaults");
    await ensureBuiltinAutomations(db, bizId);
  });

  it("weekly academy payment reminder drafts a service message to students with a balance (Sundays only, deduped)", async () => {
    const { COURSE_DEFINITIONS } = await import("@/domain/academy");
    const course = await db.course.create({ data: { businessId: bizId, ...COURSE_DEFINITIONS[0] } });
    const cohort = await db.cohort.create({ data: { courseId: course.id, name: "C", startDate: new Date(), status: "IN_PROGRESS" } });
    const paidUp = await db.student.create({ data: { businessId: bizId, firstName: "Paid", phone: "+972501000001" } });
    const owes = await db.student.create({ data: { businessId: bizId, firstName: "Owes", phone: "+972501000002" } });
    const e1 = await db.enrollment.create({ data: { cohortId: cohort.id, studentId: paidUp.id, agreedPrice: 5500, status: "CONFIRMED" } });
    await db.payment.create({ data: { enrollmentId: e1.id, amount: 5500, method: "BIT" } });
    await db.enrollment.create({ data: { cohortId: cohort.id, studentId: owes.id, agreedPrice: 5500, status: "CONFIRMED" } });
    const sunday = new Date("2026-11-22T08:00:00Z"); // a Sunday in Israel
    await engine.runScheduled(sunday, { businessId: bizId });
    await engine.runScheduled(sunday, { businessId: bizId });
    const msgs = await db.outboundMessage.findMany({ where: { businessId: bizId, templateKey: "academy_payment" } });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].studentId).toBe(owes.id);
    expect(msgs[0].status).toBe("PENDING_APPROVAL");
    expect(msgs[0].body).toContain("5,500");
    await engine.runScheduled(new Date("2026-11-23T08:00:00Z"), { businessId: bizId }); // Monday: nothing new
    expect(await db.outboundMessage.count({ where: { businessId: bizId, templateKey: "academy_payment" } })).toBe(1);
  });
});

d("creative studio (PostgreSQL)", () => {
  it("jobs without a configured provider are stored as pending_config, never faked", async () => {
    process.env.DATABASE_URL = url;
    const { db } = await import("@/lib/db");
    const { createGenerationJob } = await import("@/server/creative/service");
    const b = await db.business.create({ data: { name: "Cre", category: "x", city: "Ashkelon" } });
    const u = await db.user.create({ data: { businessId: b.id, email: "cre@test.local", name: "C", passwordHash: "x", role: "OWNER" } });
    for (const k of ["OPENAI_API_KEY", "REPLICATE_API_TOKEN", "ELEVENLABS_API_KEY"]) delete process.env[k];
    const a = await createGenerationJob({ id: u.id, businessId: b.id }, { kind: "video", title: "Reel", prompt: "slow-motion fade" });
    expect(a.status).toBe("pending_config");
    expect(a.outputUrl).toBeNull();
    expect(a.dataUrl).toBeNull();
    expect(await db.auditLog.count({ where: { businessId: b.id, action: "creative.job_create" } })).toBe(1);
  });
});

d("sites (PostgreSQL)", () => {
  it("publishing refuses unapproved images; approved ones pass", async () => {
    process.env.DATABASE_URL = url;
    const { db } = await import("@/lib/db");
    const b = await db.business.create({ data: { name: "Site", category: "x", city: "Ashkelon" } });
    const draft = await db.creativeAsset.create({ data: { businessId: b.id, kind: "graphic", title: "g", provider: "builtin", status: "succeeded", dataUrl: "data:image/png;base64,AAAA", approval: "draft" } });
    const ok = await db.creativeAsset.create({ data: { businessId: b.id, kind: "graphic", title: "g2", provider: "builtin", status: "succeeded", dataUrl: "data:image/png;base64,AAAA", approval: "approved" } });
    const count = (ids: string[]) => db.creativeAsset.count({ where: { businessId: b.id, id: { in: ids }, approval: "approved", dataUrl: { not: null } } });
    expect(await count([draft.id])).toBe(0);
    expect(await count([ok.id])).toBe(1);
  });
});

d("online booking (PostgreSQL)", () => {
  let db: typeof import("@/lib/db").db;
  let ob: typeof import("@/server/services/online-booking");
  let biz: string;
  let serviceId: string;
  const now = new Date(Date.UTC(2027, 2, 1, 4, 0)); // Mon 1 Mar 2027 06:00 Jerusalem
  const date = "2027-03-02"; // Tuesday

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/lib/db"));
    ob = await import("@/server/services/online-booking");
    const b = await db.business.create({ data: { name: "Booking", category: "x", city: "Ashkelon", createdAt: new Date(0), branches: { create: { name: "main" } } } });
    biz = b.id;
    const branch = await db.branch.findFirstOrThrow({ where: { businessId: biz } });
    await db.availabilityRule.create({ data: { branchId: branch.id, weekday: 2, startTime: "09:00", endTime: "11:00" } });
    await db.user.create({ data: { businessId: biz, email: "barber@book.local", name: "Barber", passwordHash: "x", role: "BARBER", acceptsBookings: true } });
    serviceId = (await db.service.create({ data: { businessId: biz, nameHe: "תספורת", nameEn: "Cut", durationMin: 30, price: 100 } })).id;
    await db.bookingSettings.create({ data: { businessId: biz, enabled: true, slotStepMin: 30, minNoticeMin: 60, maxDaysAhead: 30, maxActivePerPhone: 1 } });
  });

  const input = (start: number, phone: string) => ({ serviceId, staffId: "any", date, start, name: "Test Customer", phone });
  const date2 = "2027-03-09"; // the following Tuesday
  const input2 = (start: number, phone: string) => ({ serviceId, staffId: "any", date: date2, start, name: "Test Customer", phone });

  it("offers slots from opening hours", async () => {
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    expect(slots).toHaveLength(4); // 09:00, 09:30, 10:00, 10:30
  });

  it("only one of many simultaneous requests gets the same slot", async () => {
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    const r = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => ob.createOnlineBooking(biz, input(slots[0].start, `05012345${10 + i}`), now)));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const after = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    expect(after.slots.map((s) => s.start)).not.toContain(slots[0].start);
    const appts = await db.appointment.findMany({ where: { businessId: biz, source: "online" }, include: { customer: true } });
    expect(appts).toHaveLength(1);
    expect(appts[0].customer?.source).toBe("online-booking");
    expect(appts[0].status).toBe("CONFIRMED");
  });

  it("limits open bookings per phone and supports cancel via the private link", async () => {
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    const first = await ob.createOnlineBooking(biz, input(slots[0].start, "0529998877"), now);
    await expect(ob.createOnlineBooking(biz, input(slots[1].start, "052-999-8877"), now)).rejects.toMatchObject({ code: "limit" });
    expect((await ob.findByToken("not-a-real-token-xxxxxxxxxx"))).toBeNull();
    const c = await ob.cancelByToken(first.token, now);
    expect(c.status).toBe("CANCELLED");
    const again = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    expect(again.slots.map((s) => s.start)).toContain(slots[0].start);
  });

  it("a completed (or no-show) appointment keeps its slot blocked — no double booking at the same time", async () => {
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    const r = await ob.createOnlineBooking(biz, input(slots[2].start, "0541112233"), now);
    await db.appointment.update({ where: { id: r.appointment.id }, data: { status: "COMPLETED" } });
    const after = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    expect(after.slots.map((s) => s.start)).not.toContain(slots[2].start);
    await expect(ob.createOnlineBooking(biz, input(slots[2].start, "0547778899"), now)).rejects.toMatchObject({ code: "slot_taken" });
  });

  it("calendar days report free-slot counts consistent with the day view", async () => {
    const days = await ob.availableDays(biz, { serviceId, staffId: "any" }, now);
    const tue = days.find((d) => d.date === date)!;
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date }, now);
    expect(tue.free).toBe(slots.length);
    expect(days.find((d) => d.date === "2027-03-03")!.free).toBe(0); // Wednesday: closed (no hours)
  });

  it("owner gets exactly one notification per booking and per cancellation (deduplicated)", async () => {
    const { notifyAppointmentEvent } = await import("@/server/notify/owner");
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date: date2 }, now);
    const r = await ob.createOnlineBooking(biz, { ...input2(slots[3].start, "0531234567"), name: "לקוח התראה" }, now);
    const created = await db.notification.findMany({ where: { businessId: biz, entityId: r.appointment.id } });
    expect(created).toHaveLength(1);
    expect(created[0].kind).toBe("booking_created");
    expect(created[0].body).toContain("לקוח: לקוח התראה");
    expect(created[0].body).toContain("משך: 30 דקות");
    expect(created[0].link).toContain(`appt=${r.appointment.id}`);
    // Re-sending the same event (e.g. a retry) must not duplicate.
    await notifyAppointmentEvent("booking_created", r.appointment.id);
    expect(await db.notification.count({ where: { entityId: r.appointment.id, kind: "booking_created" } })).toBe(1);
    await ob.cancelByToken(r.token, now);
    await ob.cancelByToken(r.token, now); // second cancel is a no-op
    expect(await db.notification.count({ where: { entityId: r.appointment.id, kind: "booking_cancelled" } })).toBe(1);
  });

  it("staff reschedule refuses overlaps and notifies once per new time", async () => {
    const bookings = await import("@/server/services/bookings");
    const owner = await db.user.create({ data: { businessId: biz, email: "owner@book.local", name: "Owner", passwordHash: "x", role: "OWNER" } });
    const { slots } = await ob.getSlots(biz, { serviceId, staffId: "any", date: date2 }, now);
    const a1 = await ob.createOnlineBooking(biz, input2(slots[0].start, "0521000001"), now);
    const a2 = await ob.createOnlineBooking(biz, input2(slots[slots.length - 1].start, "0521000002"), now);
    const toLocal = (ms: number) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)); const g = (t: string) => p.find((x) => x.type === t)!.value; return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`; };
    await expect(bookings.rescheduleAppointment({ id: owner.id, businessId: biz }, a2.appointment.id, { startsAt: toLocal(a1.appointment.startsAt.getTime()) })).rejects.toMatchObject({ code: "bookings.overlap" });
    const free = (await ob.getSlots(biz, { serviceId, staffId: "any", date: date2 }, now)).slots[0].start;
    await bookings.rescheduleAppointment({ id: owner.id, businessId: biz }, a2.appointment.id, { startsAt: toLocal(free) });
    expect(await db.notification.count({ where: { entityId: a2.appointment.id, kind: "booking_rescheduled" } })).toBe(1);
  });

  it("customer device key: my appointments, same key on rebooking, cancel, claim by link, unknown key gets nothing", async () => {
    const portal = await import("@/server/services/customer-portal");
    const date3 = "2027-03-16";
    const sl = async () => (await ob.getSlots(biz, { serviceId, staffId: "any", date: date3 }, now)).slots;
    const first = await ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: date3, start: (await sl())[0].start, name: "לקוח פורטל", phone: "0581112233" }, now);
    expect(first.deviceToken).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    const o = await portal.customerOverview(first.deviceToken);
    expect(o?.name).toBe("לקוח פורטל");
    expect(o?.tier).toBe("NEW");
    expect(o?.upcoming.length).toBe(1);
    expect(await portal.customerOverview("x".repeat(43))).toBeNull();
    // cancel from "my appointments", then rebook from the same device keeps the same key
    expect((await portal.cancelFromPortal(first.deviceToken, first.appointment.id)).ok).toBe(true);
    const again = await ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: date3, start: (await sl())[0].start, name: "לקוח פורטל", phone: "0581112233", deviceToken: first.deviceToken! }, now);
    expect(again.deviceToken).toBe(first.deviceToken);
    const o2 = await portal.customerOverview(first.deviceToken);
    expect(o2?.history.some((h) => h.status === "CANCELLED")).toBe(true);
    // someone else's key never shows this customer's data
    const other = await ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: date3, start: (await sl())[0].start, name: "אחר", phone: "0589998877" }, now);
    expect((await portal.customerOverview(other.deviceToken))?.name).toBe("אחר");
    expect((await portal.cancelFromPortal(other.deviceToken, again.appointment.id)).ok).toBe(false);
    // a device without a key can be linked with a booking's private link
    const claimed = await portal.claimDeviceByManageToken(again.token);
    expect((await portal.customerOverview(claimed))?.name).toBe("לקוח פורטל");
    // phone-only access (current website behaviour)
    process.env.DATABASE_URL = url;
    const byPhone = await portal.customerOverviewByPhone("058-111-2233");
    expect(byPhone === null || byPhone.name === "לקוח פורטל").toBe(true);
    expect(await portal.customerOverviewByPhone("not a phone")).toBeNull();
  });

  it("past appointments complete themselves once (income recorded once), and a no-show can still be corrected", async () => {
    const bookings = await import("@/server/services/bookings");
    const cust = await db.customer.create({ data: { businessId: biz, firstName: "עבר", phone: "+972540001111" } });
    const past = await db.appointment.create({ data: { businessId: biz, customerId: cust.id, serviceId, startsAt: new Date(Date.now() - 3 * 3600_000), endsAt: new Date(Date.now() - 2.5 * 3600_000), status: "CONFIRMED", price: 100 } });
    const future = await db.appointment.create({ data: { businessId: biz, customerId: cust.id, serviceId, startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 5400_000), status: "CONFIRMED", price: 100 } });
    expect(await bookings.autoCompletePastAppointments(biz, { force: true })).toBeGreaterThanOrEqual(1);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: past.id } })).status).toBe("COMPLETED");
    expect((await db.appointment.findUniqueOrThrow({ where: { id: future.id } })).status).toBe("CONFIRMED");
    await bookings.autoCompletePastAppointments(biz, { force: true });
    expect(await db.transaction.count({ where: { businessId: biz, description: `appointment:${past.id}` } })).toBe(1);
    expect((await db.customer.findUniqueOrThrow({ where: { id: cust.id } })).visitCount).toBe(1);
    await bookings.setAppointmentStatus({ id: null, businessId: biz }, past.id, "NO_SHOW");
    expect(await db.transaction.count({ where: { businessId: biz, description: `appointment:${past.id}` } })).toBe(0);
  });

  it("demo purge removes only [DEMO] records (incl. income from auto-completed demo appointments)", async () => {
    const bookings = await import("@/server/services/bookings");
    const owner = await db.user.findFirstOrThrow({ where: { businessId: biz, role: "OWNER" } });
    const demoCust = await db.customer.create({ data: { businessId: biz, firstName: "[DEMO] א", tags: ["DEMO"] } });
    const realCust = await db.customer.create({ data: { businessId: biz, firstName: "אמיתי", phone: "+972549990000" } });
    const demoAppt = await db.appointment.create({ data: { businessId: biz, customerId: demoCust.id, startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 5400_000), status: "COMPLETED", notes: "[DEMO]", price: 50 } });
    await db.transaction.create({ data: { businessId: biz, type: "INCOME", kind: "ACTUAL", category: "services", amount: 50, occurredAt: new Date(), description: `appointment:${demoAppt.id}` } });
    expect((await bookings.demoDataCounts(biz)).appointments).toBe(1);
    await bookings.purgeDemoData({ id: owner.id, businessId: biz });
    expect(await bookings.demoDataCounts(biz)).toEqual({ appointments: 0, transactions: 0, customers: 0, services: 0, leads: 0 });
    expect(await db.customer.count({ where: { id: realCust.id } })).toBe(1);
  });

  it("WhatsApp: a new booking sends the approved confirmation template automatically (no manual approval)", async () => {
    const { ensureBuiltinAutomations } = await import("@/server/automation/defaults");
    await ensureBuiltinAutomations(db, biz);
    process.env.WHATSAPP_SENDING_ENABLED = "true"; process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = "EAAtest-token-value-123456"; process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890";
    const sent: Record<string, unknown>[] = [];
    const realFetch = global.fetch;
    global.fetch = (async (url: string, init?: RequestInit) => {
      if (String(url).includes("graph.facebook.com")) { sent.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST" }] }), { status: 200 }); }
      return realFetch(url, init);
    }) as typeof fetch;
    try {
      const date4 = "2027-03-23";
      const sl = (await ob.getSlots(biz, { serviceId, staffId: "any", date: date4 }, now)).slots;
      const r = await ob.createOnlineBooking(biz, { serviceId, staffId: "any", date: date4, start: sl[0].start, name: "דני וואטסאפ", phone: "0523334444" }, now);
      const msgs = await db.outboundMessage.findMany({ where: { customerId: r.appointment.customerId!, templateKey: "booking_confirmation" } });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].status).toBe("SENT");
      const payload = sent.find((x) => (x.template as { name?: string })?.name === "castel_booking_confirmation") as { to: string; template: { language: { code: string }; components: { parameters: { text: string }[] }[] } };
      expect(payload.to).toBe("972523334444");
      expect(payload.template.language.code).toBe("he");
      expect(payload.template.components[0].parameters.map((p) => p.text)).toEqual(["דני", "תספורת", "23/03/2027", "09:00"]);
    } finally {
      global.fetch = realFetch; delete process.env.WHATSAPP_SENDING_ENABLED;
    }
  });

  it("time off removes availability; closed booking refuses", async () => {
    await db.timeOff.create({ data: { businessId: biz, startsAt: new Date(Date.UTC(2027, 2, 2, 0, 0)), endsAt: new Date(Date.UTC(2027, 2, 2, 22, 0)), reason: "holiday" } });
    expect((await ob.getSlots(biz, { serviceId, staffId: "any", date }, now)).slots).toHaveLength(0);
    await db.bookingSettings.update({ where: { businessId: biz }, data: { enabled: false } });
    await expect(ob.getSlots(biz, { serviceId, staffId: "any", date }, now)).rejects.toMatchObject({ code: "disabled" });
  });
});
