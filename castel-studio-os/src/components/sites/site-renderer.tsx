import { AtSign, Clock, GraduationCap, MapPin, MessageCircle, Phone, Scissors, Users } from "lucide-react";
import { db } from "@/lib/db";
import { formatILS } from "@/lib/utils";
import { totalInstructionalHours } from "@/domain/academy";
import { fmt } from "@/i18n/fmt";
import type { Dictionary } from "@/i18n/he";
import type { Block } from "@/server/sites/blocks";
import { SiteLeadForm } from "./site-lead-form";

/** Renders site blocks. Services/academy blocks always show LIVE data from the system (prices stay in sync). */
export async function SiteRenderer({ businessId, blocks, slug, locale, t }: { businessId: string; blocks: Block[]; slug: string; locale: string; t: Dictionary }) {
  const he = locale === "he";
  const needs = new Set(blocks.map((b) => b.type));
  const [services, courses] = await Promise.all([
    needs.has("services") ? db.service.findMany({ where: { businessId, isActive: true, NOT: { nameEn: { startsWith: "[DEMO]" } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }) : [],
    needs.has("academy") ? db.course.findMany({ where: { businessId, isActive: true }, orderBy: { price: "asc" } }) : [],
  ]);
  const section = "mx-auto max-w-5xl px-4 py-12 md:py-16";
  const h2 = "mb-6 text-center font-display text-3xl font-bold md:text-4xl";
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "hero":
            return (
              <section key={i} className="relative overflow-hidden">
                {b.imageAssetId ? (<><img src={`/api/assets/${b.imageAssetId}`} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/80 to-[var(--bg)]" /></>) : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,76,0.18),transparent_60%)]" />}
                <div className="relative mx-auto max-w-4xl px-4 py-24 text-center md:py-32">
                  <h1 className="font-display text-4xl font-black leading-tight md:text-6xl">{b.title}</h1>
                  {b.subtitle && <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">{b.subtitle}</p>}
                  {b.ctaText && b.ctaHref && <a href={b.ctaHref} className="mt-8 inline-flex h-12 items-center rounded-full bg-gold px-8 font-semibold text-black hover:bg-gold-strong" rel="noopener">{b.ctaText}</a>}
                </div>
              </section>
            );
          case "services":
            return (
              <section key={i} className={section}><h2 className={h2}>{b.title}</h2>
                {services.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2">{services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"><span className="flex items-center gap-3"><Scissors size={18} className="text-gold" /><span><b>{he ? s.nameHe : s.nameEn}</b><span className="block text-xs text-muted">{s.durationMin} {t.common.minutes}</span></span></span>{b.showPrices && <span className="font-display text-xl text-gold">{formatILS(s.price, locale)}</span>}</li>
                  ))}</ul>
                ) : <p className="text-center text-sm text-muted">{he ? "רשימת השירותים תתעדכן בקרוב." : "Services coming soon."}</p>}
              </section>
            );
          case "academy":
            return (
              <section key={i} className={section}><h2 className={h2}>{b.title}</h2>
                <div className="grid gap-4 md:grid-cols-2">{courses.map((c) => (
                  <article key={c.id} className="rounded-2xl border border-border bg-surface p-6">
                    <div className="flex items-start justify-between gap-3"><h3 className="font-display text-xl font-bold">{he ? c.nameHe : c.nameEn}</h3><span className="font-display text-2xl text-gold">{formatILS(c.price, locale)}</span></div>
                    <p className="mt-2 text-sm text-muted">{he ? c.descriptionHe : c.descriptionEn}</p>
                    <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <li className="flex items-center gap-2"><GraduationCap size={15} className="text-gold" /> {c.lessonCount} {t.landing.lessonsTotal}</li>
                      <li className="flex items-center gap-2"><Clock size={15} className="text-gold" /> {totalInstructionalHours(c.lessonDurations)} {t.landing.hoursTotal}</li>
                      <li className="flex items-center gap-2"><Users size={15} className="text-gold" /> {c.maxStudents === 1 ? t.landing.privateOne : fmt(t.landing.maxStudentsShort, { n: c.maxStudents })}</li>
                    </ul>
                  </article>
                ))}</div>
              </section>
            );
          case "gallery":
            return b.assetIds.length ? (
              <section key={i} className={section}><h2 className={h2}>{b.title}</h2>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{b.assetIds.map((a) => <img key={a} src={`/api/assets/${a}`} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" />)}</div>
              </section>
            ) : null;
          case "text":
            return <section key={i} className={section}>{b.title && <h2 className={h2}>{b.title}</h2>}<p className="mx-auto max-w-3xl whitespace-pre-wrap text-center leading-relaxed text-muted">{b.body}</p></section>;
          case "testimonials":
            return (
              <section key={i} className={section}><h2 className={h2}>{b.title}</h2>
                <div className="grid gap-4 md:grid-cols-3">{b.items.map((it, j) => <figure key={j} className="rounded-2xl border border-border bg-surface p-5"><blockquote className="text-sm leading-relaxed">“{it.quote}”</blockquote><figcaption className="mt-3 text-xs text-gold">{it.author}</figcaption></figure>)}</div>
              </section>
            );
          case "cta":
            return (
              <section key={i} className={section}><div className="rounded-3xl border border-gold/40 bg-gold-soft p-8 text-center md:p-12">
                <h2 className="font-display text-3xl font-bold">{b.title}</h2>{b.text && <p className="mx-auto mt-3 max-w-2xl text-muted">{b.text}</p>}
                {b.buttonText && b.buttonHref && <a href={b.buttonHref} className="mt-6 inline-flex h-12 items-center rounded-full bg-gold px-8 font-semibold text-black" rel="noopener">{b.buttonText}</a>}
              </div></section>
            );
          case "leadForm":
            return (
              <section key={i} className={section}><div className="mx-auto max-w-xl rounded-2xl border border-gold/30 bg-surface p-6 md:p-8"><h2 className="mb-5 text-center font-display text-2xl font-bold">{b.title}</h2>
                <SiteLeadForm kind={b.kind} source={`site:${slug}`} labels={{ name: t.common.name, phone: t.common.phone, email: t.common.email, message: t.landing.message, consent: t.landing.consent, send: t.landing.send, thanks: t.landing.thanks, error: t.landing.error }} />
              </div></section>
            );
          case "contact":
            return (
              <section key={i} className={section}><h2 className={h2}>{b.title}</h2>
                <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
                  {b.phone && <li><a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"><Phone size={18} className="text-gold" /><span dir="ltr">{b.phone}</span></a></li>}
                  {b.whatsapp && <li><a href={b.whatsapp} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4" rel="noopener"><MessageCircle size={18} className="text-gold" />WhatsApp</a></li>}
                  {b.address && <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"><MapPin size={18} className="text-gold" />{b.address}</li>}
                  {b.instagram && <li><a href={b.instagram} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4" rel="noopener"><AtSign size={18} className="text-gold" />Instagram</a></li>}
                  {b.hours && <li className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 sm:col-span-2"><Clock size={18} className="mt-0.5 text-gold" /><span className="whitespace-pre-wrap">{b.hours}</span></li>}
                </ul>
              </section>
            );
        }
      })}
    </>
  );
}
