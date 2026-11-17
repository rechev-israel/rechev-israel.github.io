import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PreferenceToggles } from "@/components/shell/preferences";
import { bookableDates, bookableStaff, getBookingSettings, publicBusiness } from "@/server/services/online-booking";
import { toNumber } from "@/lib/utils";
import { BookingWizard } from "./wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "קביעת תור — CASTEL STUDIO אשקלון",
  description: "קביעת תור אונליין לתספורת גברים ב-CASTEL STUDIO, אשקלון.",
  robots: { index: true, follow: true },
};

export default async function BookPage() {
  const { t, locale } = await getI18n();
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const b = await publicBusiness();
  const settings = b ? await getBookingSettings(b.id) : null;
  const [services, staff] = b && settings?.enabled
    ? await Promise.all([
        db.service.findMany({ where: { businessId: b.id, isActive: true, bookableOnline: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }),
        bookableStaff(b.id),
      ])
    : [[], []];
  const ready = Boolean(settings?.enabled && services.length && staff.length);
  const dates = settings ? bookableDates(settings.maxDaysAhead) : [];
  const note = settings ? (he ? settings.noteHe : settings.noteEn) : null;

  return (
    <main className="min-h-dvh pb-16">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,76,0.16),transparent_55%)]" />
      <header className="safe-top relative mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-3"><BrandMark /><Wordmark sub="BARBERSHOP · ASHKELON" /></Link>
        <PreferenceToggles locale={locale} t={t} />
      </header>
      <section className="relative mx-auto max-w-3xl px-4 pt-4 text-center">
        <p className="mb-2 text-xs tracking-[0.35em] text-gold">CASTEL STUDIO</p>
        <h1 className="font-display text-3xl font-black md:text-5xl">{L("קביעת תור", "Book an appointment")}</h1>
        <div className="gold-rule mx-auto mt-5 w-32" />
        {note && <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-sm text-muted">{note}</p>}
      </section>
      <section className="relative mx-auto mt-6 max-w-3xl px-4">
        {ready ? (
          <BookingWizard
            locale={locale}
            services={services.map((s) => ({ id: s.id, name: he ? s.nameHe : s.nameEn, durationMin: s.durationMin, price: toNumber(s.price) }))}
            staff={staff}
            dates={dates}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="font-semibold">{L("קביעת תורים אונליין תיפתח בקרוב.", "Online booking opens soon.")}</p>
            <p className="mt-1 text-sm text-muted">{L("בינתיים אפשר לפנות אלינו בטלפון או בוואטסאפ.", "Meanwhile, contact us by phone or WhatsApp.")}</p>
          </div>
        )}
      </section>
    </main>
  );
}
