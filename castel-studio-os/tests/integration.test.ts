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
