import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, Clock, Scissors, User } from "lucide-react";
import { getI18n } from "@/i18n";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { findByToken, getBookingSettings } from "@/server/services/online-booking";
import { canCustomerCancel } from "@/domain/booking";
import { toNumber } from "@/lib/utils";
import { CancelBooking } from "./cancel";

export async function ManageContent({ token, embed = false }: { token: string; embed?: boolean }) {
  const { locale } = await getI18n();
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const a = await findByToken(token);
  if (!a) notFound();
  const settings = await getBookingSettings(a.businessId);
  const cancelled = a.status === "CANCELLED";
  const past = a.startsAt.getTime() < Date.now();
  const canCancel = !cancelled && !past && canCustomerCancel(a.startsAt.getTime(), Date.now(), settings.cancelNoticeMin);
  const when = a.startsAt.toLocaleString(he ? "he-IL" : "en-GB", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <main className={embed ? "px-4 pb-4" : "min-h-dvh px-4 pb-16"}>
      {!embed && <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,164,76,0.16),transparent_55%)]" />}
      {!embed && <header className="safe-top relative mx-auto flex max-w-xl items-center py-5"><Link href="/book" className="flex items-center gap-3"><BrandMark /><Wordmark sub="BARBERSHOP · ASHKELON" /></Link></header>}
      <section className="relative mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6">
        {cancelled ? (
          <p className="text-center font-display text-2xl font-bold">{L("התור בוטל", "Booking cancelled")}</p>
        ) : (
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-gold" size={40} />
            <h1 className="mt-2 font-display text-2xl font-bold">{a.status === "CONFIRMED" ? L(`התור נקבע${a.customer?.firstName ? `, ${a.customer.firstName}` : ""}!`, "You're booked!") : L("הבקשה התקבלה — נאשר בהקדם", "Request received — we'll confirm soon")}</h1>
          </div>
        )}
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center gap-2"><Scissors size={15} className="text-gold" /><dd>{a.service ? (he ? a.service.nameHe : a.service.nameEn) : "—"}{a.price ? ` · ₪${toNumber(a.price)}` : ""}</dd></div>
          <div className="flex items-center gap-2"><Clock size={15} className="text-gold" /><dd>{when}</dd></div>
          {a.staff && <div className="flex items-center gap-2"><User size={15} className="text-gold" /><dd>{a.staff.name}</dd></div>}
        </dl>
        {!cancelled && !past && (
          <div className="mt-5 flex flex-col gap-2">
            <a href={`/api/public/booking/ics?t=${encodeURIComponent(token)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gold/50 text-sm font-medium text-gold"><CalendarPlus size={15} /> {L("הוספה ליומן", "Add to calendar")}</a>
            {canCancel ? <CancelBooking token={token} labels={{ cancel: L("ביטול התור", "Cancel booking"), confirm: L("לבטל את התור?", "Cancel this booking?"), tooLate: L("כבר מאוחר מדי לבטל אונליין — התקשרו למספרה.", "Too late to cancel online — please call the shop."), error: L("הביטול נכשל. נסו שוב.", "Cancel failed. Try again.") }} />
              : <p className="text-center text-xs text-muted">{L(`ביטול אונליין אפשרי עד ${Math.round(settings.cancelNoticeMin / 60)} שעות לפני התור. לשינוי — צרו קשר עם המספרה.`, `Online cancellation is possible up to ${Math.round(settings.cancelNoticeMin / 60)}h before. To change, contact the shop.`)}</p>}
          </div>
        )}
        {embed ? <p className="mt-5 text-center text-[11px] text-muted">{L("קישור לניהול התור:", "Manage link:")} <a href={`/book/m/${token}`} target="_blank" rel="noopener" className="text-gold underline">{L("פתיחה בחלון חדש ושמירה", "open in a new tab and save")}</a></p>
          : <p className="mt-5 text-center text-[11px] text-muted">{L("שמרו את הקישור לדף הזה כדי לנהל את התור.", "Keep this page's link to manage your booking.")}</p>}
        <Link href={embed ? "/embed/book" : "/book"} className="mt-3 block text-center text-sm text-gold underline-offset-2 hover:underline">{L("קביעת תור נוסף", "Book another")}</Link>
      </section>
    </main>
  );
}
