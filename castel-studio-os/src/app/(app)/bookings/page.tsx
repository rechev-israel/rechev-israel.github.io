import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Scissors, Upload } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { addDays, startOfDay, toLocalInput, zonedDate, zonedParts } from "@/lib/dates";
import { formatDate, formatILS, fullName } from "@/lib/utils";
import { bookingAnalytics } from "@/server/services/bookings";
import { setAppointmentStatusAction } from "@/server/actions/bookings";
import { InlineAction } from "@/components/forms";
import { Badge, Card, CardTitle, PageHeader, Stat, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("bookings.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const sp = await searchParams;
  const anchor = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? (() => { const [y, m, d] = sp.week!.split("-").map(Number); return zonedDate(y, m, d, 12); })() : new Date();
  // week starts Sunday (Israel)
  const weekStart = startOfDay(addDays(anchor, -zonedParts(anchor).weekday));
  const weekEnd = addDays(weekStart, 7);
  const [appts, analytics, hours] = await Promise.all([
    db.appointment.findMany({
      where: { businessId: user.businessId, startsAt: { gte: weekStart, lt: weekEnd } },
      orderBy: { startsAt: "asc" },
      include: { customer: { select: { id: true, firstName: true, lastName: true } }, service: true, staff: { select: { name: true } } },
    }),
    bookingAnalytics(user.businessId),
    db.availabilityRule.findMany({ where: { branch: { businessId: user.businessId }, staffId: null, isActive: true }, orderBy: { weekday: "asc" } }),
  ]);
  const edit = can(user.role, "bookings.edit");
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = toLocalInput(new Date(), false);
  const tone = { COMPLETED: "success", CANCELLED: "neutral", NO_SHOW: "danger", SCHEDULED: "info", CONFIRMED: "gold" } as const;

  return (
    <>
      <PageHeader
        title={t.bookings.title}
        subtitle={t.bookings.subtitle}
        actions={
          <>
            <Link href="/bookings/services" className={buttonClass("secondary")}><Scissors size={14} /> {t.bookings.services}</Link>
            {edit && <Link href="/bookings/import" className={buttonClass("secondary")}><Upload size={14} /> {t.bookings.import}</Link>}
            {edit && <Link href="/bookings/new" className={buttonClass("primary")}><Plus size={14} /> {t.bookings.new}</Link>}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={t.bookings.analytics} value={analytics.total} />
        <Stat label={t.bookings.completed} value={analytics.completed} />
        <Stat label={t.bookings.cancellationRate} value={analytics.cancellationRate === null ? "—" : `${analytics.cancellationRate}%`} />
        <Stat label={t.bookings.noShowRate} value={analytics.noShowRate === null ? "—" : `${analytics.noShowRate}%`} />
        <Stat label={t.bookings.completedRevenue} value={formatILS(analytics.completedRevenue, locale)} hint={analytics.avgTicket ? `${t.finance.avgTicket}: ${formatILS(analytics.avgTicket, locale)}` : undefined} />
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg">{formatDate(weekStart, locale)} – {formatDate(addDays(weekStart, 6), locale)}</p>
          <div className="flex gap-2">
            <Link className={buttonClass("secondary", "sm")} href={`/bookings?week=${toLocalInput(addDays(weekStart, -7), false)}`}><ChevronRight size={14} className="ltr:rotate-180" /> {t.bookings.prevWeek}</Link>
            <Link className={buttonClass("ghost", "sm")} href="/bookings">{t.bookings.today}</Link>
            <Link className={buttonClass("secondary", "sm")} href={`/bookings?week=${toLocalInput(addDays(weekStart, 7), false)}`}>{t.bookings.nextWeek} <ChevronLeft size={14} className="ltr:rotate-180" /></Link>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d, i) => {
            const key = toLocalInput(d, false);
            const list = appts.filter((a) => toLocalInput(a.startsAt, false) === key);
            const h = hours.find((x) => x.weekday === i);
            return (
              <div key={key} className={`min-h-40 rounded-xl border p-2 ${key === todayKey ? "border-gold/50 bg-gold-soft" : "border-border bg-surface-2/50"}`}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <span className="text-xs font-semibold">{t.days[i]}</span>
                  <span className="text-[11px] tabular-nums text-muted">{formatDate(d, locale, { year: undefined })}</span>
                </div>
                <p className="mb-2 px-1 text-[10px] text-muted" dir="ltr">{h ? `${h.startTime}–${h.endTime}` : "—"}</p>
                <ul className="space-y-1.5">
                  {list.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border bg-surface p-2 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="tabular-nums font-semibold" dir="ltr">{toLocalInput(a.startsAt).slice(11)}</span>
                        <Badge tone={tone[a.status]}>{t.apptStatus[a.status]}</Badge>
                      </div>
                      <p className="mt-1 truncate">{a.customer ? <Link className="hover:text-gold" href={`/crm/${a.customer.id}`}>{fullName(a.customer)}</Link> : t.bookings.walkIn}</p>
                      <p className="truncate text-[11px] text-muted">{a.service ? (locale === "he" ? a.service.nameHe : a.service.nameEn) : ""}{a.staff ? ` · ${a.staff.name}` : ""}</p>
                      {edit && (a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {a.status === "SCHEDULED" && <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "CONFIRMED" }} className="h-6 px-1.5 text-[10px]">{t.bookings.confirm}</InlineAction>}
                          <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "COMPLETED" }} className="h-6 px-1.5 text-[10px] text-success">{t.bookings.markCompleted}</InlineAction>
                          <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "NO_SHOW" }} className="h-6 px-1.5 text-[10px] text-danger">{t.bookings.markNoShow}</InlineAction>
                          <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "CANCELLED" }} confirm={t.bookings.markCancelled + "?"} className="h-6 px-1.5 text-[10px]">{t.bookings.markCancelled}</InlineAction>
                        </div>
                      )}
                      {edit && (a.status === "CANCELLED" || a.status === "NO_SHOW" || a.status === "COMPLETED") && (
                        <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "SCHEDULED" }} className="mt-1 h-6 px-1.5 text-[10px]">↺</InlineAction>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>{t.external.title}</CardTitle>
        <p className="text-sm text-muted">{t.external.body}</p>
        <a href={process.env.EXTERNAL_BOOKING_URL || "https://cali-b5f0e.web.app/"} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm", "mt-3")}>{t.external.open} ↗</a>
      </Card>
    </>
  );
}
