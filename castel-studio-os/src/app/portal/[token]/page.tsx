import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n";
import { formatDate, formatDateTime, formatILS, fullName } from "@/lib/utils";
import { totalInstructionalHours } from "@/domain/academy";
import { enrollmentSummary } from "@/server/services/academy";
import { hashPortalToken, isPlausibleToken } from "@/server/academy/portal";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PreferenceToggles } from "@/components/shell/preferences";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student portal", robots: { index: false, follow: false } };

export default async function StudentPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPlausibleToken(token)) notFound();
  const student = await db.student.findUnique({
    where: { portalTokenHash: hashPortalToken(token) },
    include: { enrollments: { where: { status: { not: "CANCELLED" } }, include: { cohort: { include: { course: { include: { materials: { orderBy: [{ lessonNumber: "asc" }, { createdAt: "asc" }] } } }, lessons: { orderBy: { number: "asc" } }, instructor: { select: { name: true } } } }, attendance: true, payments: true } } },
  });
  if (!student) notFound();
  const { t, locale } = await getI18n();
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const now = new Date();
  return (
    <main className="min-h-dvh">
      <header className="no-print safe-top mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3"><BrandMark /><Wordmark sub="ACADEMY · STUDENT" /></div>
        <PreferenceToggles locale={locale} t={t} />
      </header>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pb-16">
        <h1 className="font-display text-3xl font-bold">{L("שלום", "Hi")} {student.firstName} 👋</h1>
        {student.enrollments.length === 0 && <p className="text-muted">{L("אין רישום פעיל כרגע.", "No active enrollment yet.")}</p>}
        {student.enrollments.map((e) => {
          const c = e.cohort.course;
          const s = enrollmentSummary(e, c.lessonCount);
          const nextLesson = e.cohort.lessons.find((l) => l.startsAt > now);
          return (
            <section key={e.id} className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-[11px] tracking-[0.25em] text-gold">{c.format === "GROUP" ? "GROUP" : "PRIVATE VIP"}</p>
                <h2 className="mt-1 font-display text-2xl font-bold">{locale === "he" ? c.nameHe : c.nameEn}</h2>
                <p className="text-sm text-muted">{e.cohort.name} · {c.lessonCount} {t.landing.lessonsTotal} · {totalInstructionalHours(c.lessonDurations)} {t.landing.hoursTotal}{e.cohort.instructor ? ` · ${e.cohort.instructor.name}` : ""}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{t.academy.progress}</p><p className="text-xl font-semibold">{e.progress}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-gold" style={{ width: `${e.progress}%` }} /></div></div>
                  <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{t.academy.attendance}</p><p className="text-xl font-semibold">{s.attended}/{c.lessonCount}</p></div>
                  <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{t.academy.paid}</p><p className="text-xl font-semibold">{formatILS(s.paid, locale)}</p></div>
                  <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{t.academy.balance}</p><p className={`text-xl font-semibold ${s.balance ? "text-warning" : "text-success"}`}>{formatILS(s.balance, locale)}</p></div>
                </div>
                {nextLesson && <p className="mt-4 rounded-lg border border-gold/30 bg-gold-soft/40 p-3 text-sm">{L("המפגש הבא", "Next lesson")}: <b>{t.academy.lesson} {nextLesson.number}</b> · {formatDateTime(nextLesson.startsAt, locale)} · {nextLesson.durationMin / 60} {t.common.hours}</p>}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="mb-3 font-semibold">{t.academy.schedule}</h3>
                <ul className="divide-y divide-border">
                  {e.cohort.lessons.map((l) => {
                    const att = e.attendance.find((a) => a.lessonId === l.id);
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span><b>{t.academy.lesson} {l.number}</b>{l.topic ? ` · ${l.topic}` : ""}<span className="block text-xs text-muted">{formatDateTime(l.startsAt, locale)} · {l.durationMin / 60} {t.common.hours}</span></span>
                        <span className={`text-xs ${att?.status === "PRESENT" ? "text-success" : att?.status === "ABSENT" ? "text-danger" : "text-muted"}`}>{att ? t.attendanceStatus[att.status] : l.startsAt > now ? L("מתוכנן", "Upcoming") : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {c.materials.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="mb-3 font-semibold">{t.academy.materials}</h3>
                  <ul className="space-y-2 text-sm">{c.materials.map((m) => (
                    <li key={m.id} className="rounded-lg bg-surface-2 p-3"><p className="font-medium">{m.lessonNumber ? `${t.academy.lesson} ${m.lessonNumber} · ` : ""}{m.title}</p>{m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gold underline" dir="ltr">{m.url}</a>}{m.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{m.body}</p>}</li>
                  ))}</ul>
                </div>
              )}
              {e.certificateNumber && (
                <div className="print-plain rounded-2xl border-2 border-gold/60 bg-[#0a0a0b] p-8 text-center text-[#f2ede3] print:bg-white print:text-black">
                  <BrandMark size={52} />
                  <p className="mt-3 text-sm tracking-[0.35em] text-[#c9a44c]">CASTEL STUDIO ACADEMY</p>
                  <p className="mt-2 font-display text-3xl font-bold">{L("תעודת סיום", "Certificate of Completion")}</p>
                  <p className="mt-3 font-display text-2xl text-[#e2c478]">{fullName(student)}</p>
                  <p className="mt-2 text-sm">{locale === "he" ? c.nameHe : c.nameEn} · {totalInstructionalHours(c.lessonDurations)} {t.landing.hoursTotal}</p>
                  <p className="mt-3 text-xs text-[#9d978b]" dir="ltr">{e.certificateNumber} · {formatDate(e.certificateIssuedAt, locale)}</p>
                  <div className="no-print mt-4"><PrintButton label={`${t.common.print} / PDF`} /></div>
                </div>
              )}
            </section>
          );
        })}
        <p className="pt-6 text-center text-[11px] text-muted">{L("קישור אישי — אל תשתפו אותו.", "Personal link — please don't share it.")} · CASTEL STUDIO · {L("אשקלון", "Ashkelon")}</p>
      </div>
    </main>
  );
}
