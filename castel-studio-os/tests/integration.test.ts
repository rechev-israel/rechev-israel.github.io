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
