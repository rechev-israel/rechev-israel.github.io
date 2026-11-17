"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { cohortSchema, formToObject, paymentSchema, studentSchema, type ActionState } from "@/lib/validation";
import { addPayment, convertLeadToStudent, createCohort, createStudent, enrollStudent, issueCertificate, recordAttendance, setProgress } from "@/server/services/academy";
import { runAction } from "./util";
import { headers } from "next/headers";
import { newPortalToken } from "@/server/academy/portal";
import { getI18n } from "@/i18n";

export async function createCohortAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async () => {
    const user = await requireUser("academy.edit");
    id = (await createCohort(user, cohortSchema.parse(formToObject(fd, ["weekdays"])))).id;
  });
  if (id) redirect(`/academy/cohorts/${id}`);
  return res;
}

export async function updateCohortStatusAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const status = z.enum(["PLANNED", "OPEN", "FULL", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).parse(fd.get("status"));
  const id = String(fd.get("id"));
  const r = await db.cohort.updateMany({ where: { id, course: { businessId: user.businessId } }, data: { status } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "cohort.status", entityType: "Cohort", entityId: id, metadata: { status } });
  revalidatePath(`/academy/cohorts/${id}`);
}

export async function updateLessonAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const id = String(fd.get("id"));
  const lesson = await db.lesson.findFirst({ where: { id, cohort: { course: { businessId: user.businessId } } } });
  if (!lesson) return;
  await db.lesson.update({ where: { id }, data: { topic: String(fd.get("topic") ?? "").slice(0, 200) || null } });
  revalidatePath(`/academy/cohorts/${lesson.cohortId}`);
}

export async function createStudentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const cohortId = fd.get("cohortId") ? String(fd.get("cohortId")) : "";
  const res = await runAction(async () => {
    const user = await requireUser("academy.edit");
    const s = await createStudent(user, studentSchema.parse(formToObject(fd)));
    id = s.id;
    if (cohortId) await enrollStudent(user, cohortId, s.id);
  });
  if (id) redirect(cohortId ? `/academy/cohorts/${cohortId}` : `/academy/students/${id}`);
  return res;
}

export async function enrollAction(cohortId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("academy.edit");
    const price = fd.get("agreedPrice") ? Number(fd.get("agreedPrice")) : undefined;
    await enrollStudent(user, cohortId, String(fd.get("studentId")), price && price > 0 ? price : undefined);
    revalidatePath(`/academy/cohorts/${cohortId}`);
  });
}

export async function cancelEnrollmentAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const id = String(fd.get("id"));
  const e = await db.enrollment.findFirst({ where: { id, cohort: { course: { businessId: user.businessId } } }, include: { cohort: true } });
  if (!e) return;
  await db.enrollment.update({ where: { id }, data: { status: "CANCELLED" } });
  if (e.cohort.status === "FULL") await db.cohort.update({ where: { id: e.cohortId }, data: { status: "OPEN" } });
  await audit({ businessId: user.businessId, userId: user.id, action: "enrollment.cancel", entityType: "Enrollment", entityId: id });
  revalidatePath(`/academy/cohorts/${e.cohortId}`);
}

export async function attendanceAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const status = z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]).parse(fd.get("status"));
  await recordAttendance(user, String(fd.get("enrollmentId")), String(fd.get("lessonId")), status);
  revalidatePath(`/academy/cohorts/${fd.get("cohortId")}`);
}

export async function progressAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  await setProgress(user, String(fd.get("enrollmentId")), Number(fd.get("progress")));
  revalidatePath(`/academy/cohorts/${fd.get("cohortId")}`);
}

export async function paymentAction(enrollmentId: string, cohortId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("academy.payments");
    await addPayment(user, enrollmentId, paymentSchema.parse(formToObject(fd)));
    revalidatePath(`/academy/cohorts/${cohortId}`);
  });
}

export async function issueCertificateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("academy.edit");
    await issueCertificate(user, String(fd.get("enrollmentId")));
    revalidatePath(`/academy/cohorts/${fd.get("cohortId")}`);
  });
}

export async function leadStatusAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const status = z.enum(["NEW", "CONTACTED", "QUALIFIED", "ENROLLED", "LOST"]).parse(fd.get("status"));
  const id = String(fd.get("id"));
  await db.lead.updateMany({ where: { id, businessId: user.businessId }, data: { status } });
  await audit({ businessId: user.businessId, userId: user.id, action: "lead.status", entityType: "Lead", entityId: id, metadata: { status } });
  revalidatePath("/academy/leads");
}

export async function convertLeadAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const s = await convertLeadToStudent(user, String(fd.get("id")));
  redirect(`/academy/students/${s.id}`);
}

export async function addMaterialAction(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("academy.edit");
    const input = z.object({
      title: z.string().trim().min(1).max(200),
      kind: z.enum(["link", "pdf", "video", "note"]),
      url: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().max(1000).refine((u) => /^https?:\/\//.test(u)).optional()),
      body: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(5000).optional()),
      lessonNumber: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1).max(20).optional()),
    }).parse(formToObject(fd));
    const course = await db.course.findFirst({ where: { id: courseId, businessId: user.businessId } });
    if (!course) throw new Error("not found");
    await db.courseMaterial.create({ data: { courseId, ...input } });
    revalidatePath(`/academy/courses/${courseId}`);
  });
}

export async function deleteMaterialAction(fd: FormData) {
  const user = await requireUser("academy.edit");
  const m = await db.courseMaterial.findFirst({ where: { id: String(fd.get("id")), course: { businessId: user.businessId } } });
  if (!m) return;
  await db.courseMaterial.delete({ where: { id: m.id } });
  revalidatePath(`/academy/courses/${m.courseId}`);
}

/** Create (or rotate) a student's private portal link. The raw link is returned once; only its hash is stored. */
export async function generatePortalLinkAction(studentId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("academy.edit");
    const { locale } = await getI18n();
    const st = await db.student.findFirst({ where: { id: studentId, businessId: user.businessId } });
    if (!st) throw new Error("not found");
    const { token, hash } = newPortalToken();
    await db.student.update({ where: { id: st.id }, data: { portalTokenHash: hash, portalTokenAt: new Date() } });
    await audit({ businessId: user.businessId, userId: user.id, action: "student.portal_link", entityType: "Student", entityId: st.id });
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const url = `${proto}://${host}/portal/${token}`;
    return { ok: true, message: (locale === "he" ? "הקישור האישי (מוצג פעם אחת — העתיקו ושלחו לתלמיד; יצירת קישור חדש מבטלת את הקודם):\n" : "Personal link (shown once — copy and send to the student; generating a new one revokes the old):\n") + url };
  });
}
