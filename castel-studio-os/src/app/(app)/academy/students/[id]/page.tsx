import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDate, formatILS, fullName } from "@/lib/utils";
import { enrollmentSummary } from "@/server/services/academy";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const { id } = await params;
  const s = await db.student.findFirst({
    where: { id, businessId: user.businessId },
    include: { enrollments: { include: { cohort: { include: { course: true } }, payments: true, attendance: true } } },
  });
  if (!s) notFound();
  return (
    <>
      <Link href="/academy/students" className="mb-2 inline-flex min-h-9 items-center text-xs text-muted hover:text-gold">← {t.academy.students}</Link>
      <PageHeader title={fullName(s)} subtitle={[s.phone, s.email].filter(Boolean).map((v) => `\u2066${v}\u2069`).join(" · ")} actions={<Badge tone="gold">{t.studentStatus[s.status]}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>{t.academy.experience}</CardTitle>
          <p className="whitespace-pre-wrap text-sm text-muted">{s.experience || "—"}</p>
          <CardTitle className="mt-4">{t.academy.goals}</CardTitle>
          <p className="whitespace-pre-wrap text-sm text-muted">{s.goals || "—"}</p>
        </Card>
        <div className="space-y-4 lg:col-span-2">
          {s.enrollments.length ? s.enrollments.map((e) => {
            const sum = enrollmentSummary(e, e.cohort.course.lessonCount);
            return (
              <Card key={e.id}>
                <CardTitle action={<Badge>{t.enrollmentStatus[e.status]}</Badge>}>
                  <Link href={`/academy/cohorts/${e.cohortId}`} className="hover:text-gold">{e.cohort.name}</Link>
                </CardTitle>
                <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><dt className="text-xs text-muted">{t.academy.attendance}</dt><dd>{sum.attended}/{e.cohort.course.lessonCount}</dd></div>
                  <div><dt className="text-xs text-muted">{t.academy.progress}</dt><dd>{e.progress}%</dd></div>
                  <div><dt className="text-xs text-muted">{t.academy.paid}</dt><dd>{formatILS(sum.paid, locale)}</dd></div>
                  <div><dt className="text-xs text-muted">{t.academy.balance}</dt><dd className={sum.balance ? "text-warning" : "text-success"}>{formatILS(sum.balance, locale)}</dd></div>
                </dl>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-gold" style={{ width: `${e.progress}%` }} /></div>
                {e.certificateNumber && <Link href={`/academy/certificate/${e.id}`} className="mt-3 inline-block text-xs text-gold underline">{t.academy.certificate} {e.certificateNumber} · {formatDate(e.certificateIssuedAt, locale)}</Link>}
              </Card>
            );
          }) : <EmptyState title={t.common.empty} />}
        </div>
      </div>
    </>
  );
}
