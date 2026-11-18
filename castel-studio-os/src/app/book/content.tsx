import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PreferenceToggles } from "@/components/shell/preferences";
import { bookableDates, bookableStaff, getBookingSettings, publicBusiness } from "@/server/services/online-booking";
import { toNumber } from "@/lib/utils";
import { BookingWizard } from "./wizard";

export async function BookingPageContent({ embed = false }: { embed?: boolean }) {
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
  // Non-sensitive reason, visible only in the page source, to diagnose why booking is closed.
  const closedReason = !settings?.enabled ? "disabled" : !services.length ? "no_services" : !staff.length ? "no_staff" : "";
  const dates = settings ? bookableDates(settings.maxDaysAhead) : [];
  const note = settings ? (he ? settings.noteHe : settings.noteEn) : null;
  const branch = b ? await db.branch.findFirst({ where: { businessId: b.id, isActive: true }, orderBy: { createdAt: "asc" }, select: { phone: true } }) : null;
  const phone = branch?.phone?.trim() || "";
  const intl = phone.replace(/[^\d]/g, "").replace(/^0/, "972");

  return (
    <main className={embed ? "pb-4" : "min-h-dvh pb-16"}>
      {!embed && <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,76,0.16),transparent_55%)]" />}
      {!embed && <header className="safe-top relative mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-3"><BrandMark /><Wordmark sub="BARBERSHOP · ASHKELON" /></Link>
        <PreferenceToggles locale={locale} t={t} />
      </header>}
      {!embed && <section className="relative mx-auto max-w-3xl px-4 pt-4 text-center">
        <p className="mb-2 text-xs tracking-[0.35em] text-gold">CASTEL STUDIO</p>
        <h1 className="font-display text-3xl font-black md:text-5xl">{L("קביעת תור", "Book an appointment")}</h1>
        <div className="gold-rule mx-auto mt-5 w-32" />
        {note && <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-sm text-muted">{note}</p>}
      </section>}
      {embed && note && <p className="mx-auto mb-3 max-w-3xl whitespace-pre-line px-4 text-center text-sm text-muted">{note}</p>}
      <section className={`relative mx-auto max-w-3xl px-4 ${embed ? "pt-1" : "mt-6"}`}>
        {ready ? (
          <BookingWizard
            locale={locale}
            services={services.map((s) => ({ id: s.id, name: he ? s.nameHe : s.nameEn, durationMin: s.durationMin, price: toNumber(s.price) }))}
            staff={staff}
            dates={dates}
            embed={embed}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center" data-closed-reason={closedReason}>
            <p className="font-semibold">{L("קביעת תורים אונליין תיפתח בקרוב.", "Online booking opens soon.")}</p>
            <p className="mt-1 text-sm text-muted">{L("בינתיים אפשר לפנות אלינו בטלפון או בוואטסאפ.", "Meanwhile, contact us by phone or WhatsApp.")}</p>
            {phone && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <a href={`tel:${phone}`} dir="ltr" className="inline-flex h-11 items-center rounded-xl border border-gold/50 px-4 text-sm text-gold">{phone}</a>
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-black">WhatsApp</a>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
