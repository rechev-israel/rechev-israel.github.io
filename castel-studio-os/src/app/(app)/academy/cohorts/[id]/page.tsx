import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, UserPlus } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatILS, fullName, toNumber } from "@/lib/utils";
import { toLocalInput } from "@/lib/dates";
import { totalInstructionalHours } from "@/domain/academy";
import { enrollmentSummary, getCohortForBusiness } from "@/server/services/academy";
import {
  attendanceAction, cancelEnrollmentAction, enrollAction, issueCertificateAction, paymentAction, progressAction, updateCohortStatusAction, updateLessonAction,
} from "@/server/actions/academy";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { AutoSubmitSelect } from "@/components/academy/auto-submit-select";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { id } = await params;
  const cohort = await getCohortForBusiness(user.businessId, id);
  if (!cohort) notFound();
  const edit = can(user.role, "academy.edit");
  const payments = can(user.role, "academy.payments");
  const active = cohort.enrollments.filter((e) => e.status !== "CANCELLED");
  const seatsLeft = cohort.course.maxStudents - active.length;
  const enrolledIds = new Set(active.map((e) => e.studentId));
  const candidates = edit && seatsLeft > 0
    ? (await db.student.findMany({ where: { businessId: user.businessId, status: { in: ["LEAD", "ENROLLED", "ACTIVE"] } }, orderBy: { createdAt: "desc" }, take: 300 })).filter((s) => !enrolledIds.has(s.id))
    : [];
  const attendanceOpts = [{ value: "", label: "—" }, ...(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).map((s) => ({ value: s, label: t.attendanceStatus[s] }))];
  const now = new Date();
  const contracted = active.reduce((s, e) => s + toNumber(e.agreedPrice), 0);
  const collected = active.reduce((s, e) => s + e.payments.reduce((x, p) => x + toNumber(p.amount), 0), 0);

  return (
    <>
      <Link href="/academy" className="mb-3 inline-block text-xs text-muted hover:text-gold">← {t.academy.title}</Link>
      <PageHeader
        title={cohort.name}
        subtitle={`${locale === "he" ? cohort.course.nameHe : cohort.course.nameEn} · ${formatILS(cohort.course.price, locale)} · ${totalInstructionalHours(cohort.course.lessonDurations)} ${t.common.hours}`}
        actions={
          edit ? (
            <div className="w-44">
              <AutoSubmitSelect
                action={updateCohortStatusAction}
                fields={{ id: cohort.id }}
                name="status"
                value={cohort.status}
                label={t.academy.cohortStatus}
                options={(["PLANNED", "OPEN", "FULL", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => ({ value: s, label: t.cohortStatus[s] }))}
                className="h-10 text-sm"
              />
            </div>
          ) : <Badge tone="gold">{t.cohortStatus[cohort.status]}</Badge>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t.academy.enrolled} value={`${active.length}/${cohort.course.maxStudents}`} />
        <Stat label={t.academy.instructor} value={<span className="text-lg">{cohort.instructor?.name ?? "—"}</span>} />
        <Stat label={t.academy.agreedPrice} value={formatILS(contracted, locale)} />
        <Stat label={t.academy.paid} value={formatILS(collected, locale)} hint={`${t.academy.balance}: ${formatILS(contracted - collected, locale)}`} />
      </div>

      <Card className="mb-4">
        <CardTitle>{t.academy.schedule}</CardTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cohort.lessons.map((l) => (
            <div key={l.id} className={`rounded-xl border p-3 ${l.startsAt < now ? "border-border bg-surface-2/50" : "border-gold/30 bg-gold-soft"}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{t.academy.lesson} {l.number}</span>
                <Badge tone={l.durationMin > 120 ? "gold" : "neutral"}>{l.durationMin / 60} {t.common.hours}</Badge>
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted">{t.days[new Date(toLocalInput(l.startsAt, false) + "T12:00:00Z").getUTCDay()]} · {formatDateTime(l.startsAt, locale)}</p>
              {edit ? (
                <form action={updateLessonAction} className="mt-2 flex gap-1">
                  <input type="hidden" name="id" value={l.id} />
                  <Input name="topic" defaultValue={l.topic ?? ""} placeholder={t.academy.topic} className="h-8 text-xs" />
                  <SubmitButton size="sm" variant="ghost">✓</SubmitButton>
                </form>
              ) : l.topic && <p className="mt-2 text-xs">{l.topic}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle action={edit && seatsLeft > 0 ? <Link href={`/academy/students/new?cohortId=${cohort.id}`} className={buttonClass("outline", "sm")}><UserPlus size={13} /> {t.academy.newStudent}</Link> : undefined}>
          {t.academy.students} · {t.academy.attendance}
        </CardTitle>
        {seatsLeft <= 0 && <Notice tone="gold" className="mb-3">{t.academy.full}</Notice>}
        {cohort.enrollments.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.common.name}</Th>
                {cohort.lessons.map((l) => <Th key={l.id} className="text-center">{l.number}</Th>)}
                <Th>{t.academy.progress}</Th>
                <Th>{t.academy.paid}</Th>
                <Th>{t.academy.certificate}</Th>
              </tr>
            </thead>
            <tbody>
              {cohort.enrollments.map((e) => {
                const s = enrollmentSummary(e, cohort.course.lessonCount);
                const cancelled = e.status === "CANCELLED";
                return (
                  <tr key={e.id} className={cancelled ? "opacity-50" : ""}>
                    <Td className="min-w-40">
                      <Link href={`/academy/students/${e.studentId}`} className="font-medium hover:text-gold">{fullName(e.student)}</Link>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge tone={e.status === "CONFIRMED" ? "success" : e.status === "COMPLETED" ? "gold" : "neutral"}>{t.enrollmentStatus[e.status]}</Badge>
                        {edit && !cancelled && !e.certificateNumber && <InlineAction action={cancelEnrollmentAction} fields={{ id: e.id }} confirm={t.common.cancel + "?"} className="h-5 px-1 text-[10px]">✕</InlineAction>}
                      </div>
                    </Td>
                    {cohort.lessons.map((l) => {
                      const rec = e.attendance.find((a) => a.lessonId === l.id);
                      return (
                        <Td key={l.id} className="min-w-20 px-1.5">
                          {edit && !cancelled ? (
                            <AutoSubmitSelect action={attendanceAction} fields={{ enrollmentId: e.id, lessonId: l.id, cohortId: cohort.id }} name="status" value={rec?.status ?? ""} options={attendanceOpts} label={`${t.academy.lesson} ${l.number}`}
                              className={rec?.status === "PRESENT" ? "text-success" : rec?.status === "ABSENT" ? "text-danger" : rec?.status === "LATE" ? "text-warning" : ""} />
                          ) : <span className="text-xs">{rec ? t.attendanceStatus[rec.status] : "—"}</span>}
                        </Td>
                      );
                    })}
                    <Td className="min-w-24">
                      {edit && !cancelled ? (
                        <AutoSubmitSelect action={progressAction} fields={{ enrollmentId: e.id, cohortId: cohort.id }} name="progress" value={String(Math.round(e.progress / 10) * 10)} label={t.academy.progress}
                          options={Array.from({ length: 11 }, (_, i) => ({ value: String(i * 10), label: `${i * 10}%` }))} />
                      ) : `${e.progress}%`}
                    </Td>
                    <Td className="min-w-52">
                      <p className="text-xs tabular-nums">{formatILS(s.paid, locale)} / {formatILS(e.agreedPrice, locale)}</p>
                      {s.balance > 0 ? <Badge tone="warning">{t.academy.balance}: {formatILS(s.balance, locale)}</Badge> : <Badge tone="success">✓</Badge>}
                      {payments && !cancelled && s.balance > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-gold">{t.academy.addPayment}</summary>
                          <ActionForm action={paymentAction.bind(null, e.id, cohort.id)} resetOnSuccess showSuccess={false} className="mt-2 grid gap-1.5">
                            <Input name="amount" type="number" min={1} step="1" defaultValue={s.balance} className="h-8 text-xs" aria-label={t.common.amount} />
                            <FieldError name="amount" />
                            <Select name="method" className="h-8 text-xs" aria-label={t.academy.method}>{(["BIT", "CREDIT_CARD", "BANK_TRANSFER", "CASH", "PAYBOX", "OTHER"] as const).map((m) => <option key={m} value={m}>{t.paymentMethod[m]}</option>)}</Select>
                            <Input name="paidAt" type="date" defaultValue={toLocalInput(new Date(), false)} className="h-8 text-xs" aria-label={t.common.date} />
                            <Input name="reference" placeholder="#" className="h-8 text-xs" aria-label="reference" />
                            <SubmitButton size="sm">{t.common.save}</SubmitButton>
                          </ActionForm>
                        </details>
                      )}
                      {e.payments.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[10px] text-muted">
                          {e.payments.map((p) => <li key={p.id}>{formatDate(p.paidAt, locale)} · {formatILS(p.amount, locale)} · {t.paymentMethod[p.method]}</li>)}
                        </ul>
                      )}
                    </Td>
                    <Td className="min-w-36">
                      {e.certificateNumber ? (
                        <Link href={`/academy/certificate/${e.id}`} className={buttonClass("outline", "sm")}><Award size={12} /> {e.certificateNumber}</Link>
                      ) : s.eligible && edit ? (
                        <ActionForm action={issueCertificateAction} showSuccess={false}>
                          <input type="hidden" name="enrollmentId" value={e.id} />
                          <input type="hidden" name="cohortId" value={cohort.id} />
                          <SubmitButton size="sm" variant="primary"><Award size={12} /> {t.academy.issueCertificate}</SubmitButton>
                        </ActionForm>
                      ) : (
                        <div className="text-[10px] text-muted">
                          <p>{t.academy.notEligible}</p>
                          {s.reasons.map((r) => <p key={r}>• {t.academy.reasons[r as "unpaid" | "attendance"]}</p>)}
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState title={t.common.empty} />}

        {edit && seatsLeft > 0 && candidates.length > 0 && (
          <ActionForm action={enrollAction.bind(null, cohort.id)} className="mt-4 grid items-end gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_160px_auto]">
            <div><Label>{t.academy.enroll}</Label><Select name="studentId" required>{candidates.map((c) => <option key={c.id} value={c.id}>{fullName(c)} · {t.studentStatus[c.status]}</option>)}</Select></div>
            <div><Label>{t.academy.agreedPrice} ₪</Label><Input name="agreedPrice" type="number" min={0} defaultValue={toNumber(cohort.course.price)} /></div>
            <SubmitButton>{t.academy.enroll}</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
