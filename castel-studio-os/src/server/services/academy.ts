import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { zonedDate } from "@/lib/dates";
import { toNumber } from "@/lib/utils";
import { certificateEligibility, certificateNumber, enrollmentBalance, generateLessonSchedule } from "@/domain/academy";
import { DomainError } from "./crm";
import { emitEvent } from "@/server/automation/engine";
import { Prisma, type AttendanceStatus, type PaymentMethod } from "@prisma/client";
import type { z } from "zod";
import type { cohortSchema, studentSchema, paymentSchema } from "@/lib/validation";

type Actor = { id: string; businessId: string };

export async function createCohort(actor: Actor, input: z.infer<typeof cohortSchema>) {
  const course = await db.course.findFirst({ where: { id: input.courseId, businessId: actor.businessId } });
  if (!course) throw new DomainError("errors.notFound", "courseId");
  const [y, m, d] = input.startDate.split("-").map(Number);
  const schedule = generateLessonSchedule({
    startDate: zonedDate(y, m, d, 12),
    lessonDurations: course.lessonDurations,
    weekdays: input.weekdays,
    time: input.time,
  });
  const cohort = await db.cohort.create({
    data: {
      courseId: course.id,
      name: input.name,
      startDate: schedule[0]?.startsAt ?? zonedDate(y, m, d),
      status: input.status,
      instructorId: input.instructorId || null,
      branchId: (await db.branch.findFirst({ where: { businessId: actor.businessId } }))?.id,
      lessons: { create: schedule },
    },
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "cohort.create", entityType: "Cohort", entityId: cohort.id });
  return cohort;
}

export async function getCohortForBusiness(businessId: string, cohortId: string) {
  return db.cohort.findFirst({
    where: { id: cohortId, course: { businessId } },
    include: {
      course: true,
      instructor: { select: { id: true, name: true } },
      lessons: { orderBy: { number: "asc" } },
      enrollments: {
        orderBy: { createdAt: "asc" },
        include: { student: true, attendance: true, payments: { orderBy: { paidAt: "asc" } } },
      },
    },
  });
}

export async function createStudent(actor: Actor, input: z.infer<typeof studentSchema>) {
  const s = await db.student.create({ data: { businessId: actor.businessId, ...input, lastName: input.lastName ?? null, phone: input.phone ?? null, email: input.email ?? null } });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "student.create", entityType: "Student", entityId: s.id });
  return s;
}

/** Enroll with capacity enforcement inside a serializable transaction (retried on serialization conflicts). */
export async function enrollStudent(actor: Actor, cohortId: string, studentId: string, agreedPrice?: number) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await enrollOnce(actor, cohortId, studentId, agreedPrice);
    } catch (e) {
      if (attempt < 8 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
        await new Promise((r) => setTimeout(r, Math.random() * 40 * attempt));
        continue;
      }
      throw e;
    }
  }
}

async function enrollOnce(actor: Actor, cohortId: string, studentId: string, agreedPrice?: number) {
  return db.$transaction(
    async (tx) => {
      const cohort = await tx.cohort.findFirst({ where: { id: cohortId, course: { businessId: actor.businessId } }, include: { course: true } });
      const student = await tx.student.findFirst({ where: { id: studentId, businessId: actor.businessId } });
      if (!cohort || !student) throw new DomainError("errors.notFound");
      if (cohort.status === "CANCELLED" || cohort.status === "COMPLETED") throw new DomainError("errors.validation");
      const active = await tx.enrollment.count({ where: { cohortId, status: { not: "CANCELLED" } } });
      if (active >= cohort.course.maxStudents) throw new DomainError("academy.capacityError");
      const existing = await tx.enrollment.findUnique({ where: { studentId_cohortId: { studentId, cohortId } } });
      const e = existing
        ? await tx.enrollment.update({ where: { id: existing.id }, data: { status: "PENDING" } })
        : await tx.enrollment.create({ data: { cohortId, studentId, agreedPrice: agreedPrice ?? cohort.course.price, status: "PENDING" } });
      if (active + 1 >= cohort.course.maxStudents && cohort.status === "OPEN") await tx.cohort.update({ where: { id: cohortId }, data: { status: "FULL" } });
      if (student.status === "LEAD") await tx.student.update({ where: { id: studentId }, data: { status: "ENROLLED" } });
      return e;
    },
    { isolationLevel: "Serializable" },
  ).then(async (e) => {
    await audit({ businessId: actor.businessId, userId: actor.id, action: "enrollment.create", entityType: "Enrollment", entityId: e.id });
    await emitEvent(actor.businessId, "enrollment.created", { enrollment: { id: e.id, cohortId, studentId } });
    return e;
  });
}

async function enrollmentForBusiness(businessId: string, enrollmentId: string) {
  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId, cohort: { course: { businessId } } },
    include: { payments: true, attendance: true, cohort: { include: { course: true, lessons: true } }, student: true },
  });
  if (!e) throw new DomainError("errors.notFound");
  return e;
}

export async function recordAttendance(actor: Actor, enrollmentId: string, lessonId: string, status: AttendanceStatus) {
  const e = await enrollmentForBusiness(actor.businessId, enrollmentId);
  if (!e.cohort.lessons.some((l) => l.id === lessonId)) throw new DomainError("errors.notFound");
  await db.attendance.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    create: { enrollmentId, lessonId, status },
    update: { status, recordedAt: new Date() },
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "attendance.record", entityType: "Enrollment", entityId: enrollmentId, metadata: { lessonId, status } });
}

/** Records a payment AND the matching ACTUAL income transaction atomically. */
export async function addPayment(actor: Actor, enrollmentId: string, input: z.infer<typeof paymentSchema>) {
  const e = await enrollmentForBusiness(actor.businessId, enrollmentId);
  const paidAt = new Date(input.paidAt + "T12:00:00Z");
  const p = await db.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        businessId: actor.businessId, type: "INCOME", kind: "ACTUAL", category: "academy", amount: input.amount, occurredAt: paidAt,
        method: input.method as PaymentMethod, description: `Academy: ${e.student.firstName} ${e.student.lastName ?? ""} — ${e.cohort.name}`.trim(),
      },
    });
    const pay = await tx.payment.create({ data: { enrollmentId, amount: input.amount, method: input.method as PaymentMethod, paidAt, reference: input.reference ?? null, transactionId: t.id } });
    if (e.status === "PENDING") await tx.enrollment.update({ where: { id: enrollmentId }, data: { status: "CONFIRMED" } });
    return pay;
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "payment.create", entityType: "Enrollment", entityId: enrollmentId, metadata: { amount: input.amount } });
  return p;
}

export async function setProgress(actor: Actor, enrollmentId: string, progress: number) {
  await enrollmentForBusiness(actor.businessId, enrollmentId);
  await db.enrollment.update({ where: { id: enrollmentId }, data: { progress: Math.max(0, Math.min(100, Math.round(progress))) } });
}

export function enrollmentSummary(e: { agreedPrice: unknown; payments: { amount: unknown }[]; attendance: { status: string }[] }, lessonCount: number) {
  const { paid, balance } = enrollmentBalance(toNumber(e.agreedPrice as never), e.payments.map((p) => ({ amount: toNumber(p.amount as never) })));
  const attended = e.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  return { paid, balance, attended, ...certificateEligibility({ balance, attendedLessons: attended, lessonCount }) };
}

export async function issueCertificate(actor: Actor, enrollmentId: string) {
  const e = await enrollmentForBusiness(actor.businessId, enrollmentId);
  if (e.certificateNumber) return e;
  const s = enrollmentSummary(e, e.cohort.course.lessonCount);
  if (!s.eligible) throw new DomainError("academy.notEligible");
  const year = new Date().getFullYear();
  const issued = await db.$transaction(async (tx) => {
    const count = await tx.enrollment.count({ where: { certificateNumber: { startsWith: `CSA-${year}-` } } });
    const u = await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { certificateNumber: certificateNumber(year, count + 1), certificateIssuedAt: new Date(), status: "COMPLETED", progress: 100 },
    });
    await tx.student.update({ where: { id: e.studentId }, data: { status: "GRADUATED" } });
    return u;
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "certificate.issue", entityType: "Enrollment", entityId: enrollmentId, metadata: { number: issued.certificateNumber } });
  return issued;
}

export async function convertLeadToStudent(actor: Actor, leadId: string) {
  const lead = await db.lead.findFirst({ where: { id: leadId, businessId: actor.businessId } });
  if (!lead) throw new DomainError("errors.notFound");
  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const student = await db.student.create({
    data: { businessId: actor.businessId, firstName, lastName: rest.join(" ") || null, phone: lead.phone, email: lead.email, goals: lead.message, status: "LEAD" },
  });
  await db.lead.update({ where: { id: leadId }, data: { status: "QUALIFIED" } });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "lead.convert", entityType: "Lead", entityId: leadId, metadata: { studentId: student.id } });
  return student;
}
