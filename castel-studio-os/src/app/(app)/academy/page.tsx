import Link from "next/link";
import { BookOpen, ExternalLink, Plus, UserPlus, Users } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate, formatILS, toNumber } from "@/lib/utils";
import { totalInstructionalHours } from "@/domain/academy";
import { Badge, Card, CardTitle, EmptyState, PageHeader, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Academy" };

export default async function AcademyPage() {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const [courses, cohorts, studentCount, leadCount, enrollments] = await Promise.all([
    db.course.findMany({ where: { businessId: user.businessId }, orderBy: { price: "asc" } }),
    db.cohort.findMany({
      where: { course: { businessId: user.businessId } },
      orderBy: { startDate: "desc" },
      include: { course: true, instructor: { select: { name: true } }, _count: { select: { enrollments: { where: { status: { not: "CANCELLED" } } } } } },
    }),
    db.student.count({ where: { businessId: user.businessId, status: { in: ["ENROLLED", "ACTIVE"] } } }),
    db.lead.count({ where: { businessId: user.businessId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } } }),
    db.enrollment.findMany({ where: { cohort: { course: { businessId: user.businessId } }, status: { not: "CANCELLED" } }, select: { agreedPrice: true, payments: { select: { amount: true } } } }),
  ]);
  const contracted = enrollments.reduce((s, e) => s + toNumber(e.agreedPrice), 0);
  const collected = enrollments.reduce((s, e) => s + e.payments.reduce((x, p) => x + toNumber(p.amount), 0), 0);
  const edit = can(user.role, "academy.edit");
  const statusTone = { PLANNED: "neutral", OPEN: "success", FULL: "gold", IN_PROGRESS: "info", COMPLETED: "neutral", CANCELLED: "danger" } as const;

  return (
    <>
      <PageHeader
        title={t.academy.title}
        subtitle={t.academy.subtitle}
        actions={
          <>
            <Link href="/join" target="_blank" className={buttonClass("secondary")}><ExternalLink size={14} /> {t.academy.landing}</Link>
            <Link href="/academy/leads" className={buttonClass("secondary")}>{t.academy.leads} ({leadCount})</Link>
            <Link href="/academy/students" className={buttonClass("secondary")}><Users size={14} /> {t.academy.students}</Link>
            {edit && <Link href="/academy/cohorts/new" className={buttonClass("primary")}><Plus size={14} /> {t.academy.newCohort}</Link>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t.dashboard.students} value={studentCount} />
        <Stat label={t.dashboard.openLeads} value={leadCount} />
        <Stat label={t.academy.agreedPrice} value={formatILS(contracted, locale)} />
        <Stat label={t.academy.paid} value={formatILS(collected, locale)} hint={`${t.academy.balance}: ${formatILS(contracted - collected, locale)}`} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        {courses.map((c) => (
          <Card key={c.id} className="relative overflow-hidden">
            <div className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="gold">{c.format === "GROUP" ? "GROUP" : "VIP"}</Badge>
                <h3 className="mt-2 font-display text-xl font-bold">{locale === "he" ? c.nameHe : c.nameEn}</h3>
                <p className="mt-1 text-sm text-muted">{locale === "he" ? c.descriptionHe : c.descriptionEn}</p>
              </div>
              <p className="font-display text-2xl font-bold gold-text">{formatILS(c.price, locale)}</p>
            </div>
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-surface-2 p-2"><dt className="text-muted">{t.academy.lessons}</dt><dd className="mt-1 text-base font-semibold">{c.lessonCount}</dd></div>
              <div className="rounded-lg bg-surface-2 p-2"><dt className="text-muted">{t.academy.lessonsPerWeek}</dt><dd className="mt-1 text-base font-semibold">{c.lessonsPerWeek}</dd></div>
              <div className="rounded-lg bg-surface-2 p-2"><dt className="text-muted">{t.academy.totalHours}</dt><dd className="mt-1 text-base font-semibold">{totalInstructionalHours(c.lessonDurations)}</dd></div>
              <div className="rounded-lg bg-surface-2 p-2"><dt className="text-muted">{t.academy.maxStudents}</dt><dd className="mt-1 text-base font-semibold">{c.maxStudents}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-muted" dir="ltr">{c.lessonDurations.map((m) => `${m / 60}h`).join(" · ")}</p>
            <Link href={`/academy/courses/${c.id}`} className={buttonClass("ghost", "sm", "mt-3")}><BookOpen size={13} /> {t.academy.materials}</Link>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>{t.academy.cohorts}</CardTitle>
        {cohorts.length ? (
          <Table>
            <thead><tr><Th>{t.common.name}</Th><Th>{t.academy.courses}</Th><Th>{t.academy.startDate}</Th><Th>{t.academy.instructor}</Th><Th>{t.academy.seats}</Th><Th>{t.common.status}</Th></tr></thead>
            <tbody>
              {cohorts.map((co) => (
                <tr key={co.id} className="hover:bg-surface-2/60">
                  <Td><Link href={`/academy/cohorts/${co.id}`} className="font-medium hover:text-gold">{co.name}</Link></Td>
                  <Td className="text-muted">{co.course.format === "GROUP" ? "GROUP" : "VIP"}</Td>
                  <Td className="tabular-nums text-muted">{formatDate(co.startDate, locale)}</Td>
                  <Td className="text-muted">{co.instructor?.name ?? "—"}</Td>
                  <Td className="tabular-nums">{co._count.enrollments}/{co.course.maxStudents}</Td>
                  <Td><Badge tone={statusTone[co.status]}>{t.cohortStatus[co.status]}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={t.academy.noCohorts} icon={<UserPlus size={26} />}>
            {edit && <Link href="/academy/cohorts/new" className={buttonClass("primary", "sm", "mt-2")}>{t.academy.newCohort}</Link>}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
