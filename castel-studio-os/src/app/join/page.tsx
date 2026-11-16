import type { Metadata } from "next";
import { Clock, GraduationCap, Scissors, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getI18n, fmt } from "@/i18n";
import { formatILS } from "@/lib/utils";
import { totalInstructionalHours } from "@/domain/academy";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PreferenceToggles } from "@/components/shell/preferences";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "CASTEL STUDIO ACADEMY — קורס ספרות גברים באשקלון",
  description: "קורסי ספרות גברים מקצועיים באשקלון: קורס קבוצתי (עד 5 תלמידים) וקורס VIP פרטי.",
  robots: { index: true, follow: true },
};

export default async function JoinPage() {
  const { t, locale } = await getI18n();
  const business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
  const courses = business ? await db.course.findMany({ where: { businessId: business.id, isActive: true }, orderBy: { price: "asc" } }) : [];
  return (
    <main className="min-h-dvh">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,76,0.16),transparent_55%)]" />
      <header className="safe-top relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3"><BrandMark /><Wordmark sub="ACADEMY · ASHKELON" /></div>
        <PreferenceToggles locale={locale} t={t} />
      </header>
      <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-10 text-center md:pt-16">
        <p className="mb-3 text-xs tracking-[0.35em] text-gold">CASTEL STUDIO ACADEMY</p>
        <h1 className="font-display text-4xl font-black leading-tight md:text-6xl">{t.landing.hero}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted">{t.landing.sub}</p>
        <div className="gold-rule mx-auto mt-8 w-40" />
      </section>
      <section className="relative mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2">
        {courses.map((c) => (
          <article key={c.id} className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-gold/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] tracking-[0.25em] text-gold">{c.format === "GROUP" ? "GROUP" : "PRIVATE VIP"}</p>
                <h2 className="mt-2 font-display text-2xl font-bold">{locale === "he" ? c.nameHe : c.nameEn}</h2>
              </div>
              <div className="text-end">
                <p className="font-display text-3xl font-black gold-text">{formatILS(c.price, locale)}</p>
                <p className="text-[11px] text-muted">{t.landing.perCourse}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{locale === "he" ? c.descriptionHe : c.descriptionEn}</p>
            <ul className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <li className="flex items-center gap-2"><Scissors size={15} className="text-gold" /> {c.lessonCount} {t.landing.lessonsTotal}</li>
              <li className="flex items-center gap-2"><Clock size={15} className="text-gold" /> {totalInstructionalHours(c.lessonDurations)} {t.landing.hoursTotal}</li>
              <li className="flex items-center gap-2"><GraduationCap size={15} className="text-gold" /> {c.lessonsPerWeek}× / {locale === "he" ? "שבוע" : "week"}</li>
              <li className="flex items-center gap-2"><Users size={15} className="text-gold" /> {c.maxStudents === 1 ? t.landing.privateOne : fmt(t.landing.maxStudentsShort, { n: c.maxStudents })}</li>
            </ul>
          </article>
        ))}
      </section>
      <section className="relative mx-auto max-w-xl px-4 py-14">
        <div className="rounded-2xl border border-gold/30 bg-surface p-6 md:p-8">
          <h2 className="mb-5 text-center font-display text-2xl font-bold">{t.landing.formTitle}</h2>
          <LeadForm
            courses={courses.map((c) => ({ code: c.code, name: locale === "he" ? c.nameHe : c.nameEn }))}
            labels={{ name: t.common.name, phone: t.common.phone, email: t.common.email, interested: t.landing.interested, message: t.landing.message, consent: t.landing.consent, send: t.landing.send, thanks: t.landing.thanks, error: t.landing.error }}
          />
        </div>
      </section>
      <footer className="safe-bottom relative border-t border-border py-6 text-center text-xs text-muted">
        CASTEL STUDIO · {locale === "he" ? "אשקלון" : "Ashkelon"} · <a className="text-gold" href="https://www.instagram.com/castel.cutzz" target="_blank" rel="noopener noreferrer">@castel.cutzz</a>
      </footer>
    </main>
  );
}
