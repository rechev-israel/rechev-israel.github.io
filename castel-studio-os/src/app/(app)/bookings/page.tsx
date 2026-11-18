import Link from "next/link";
import { Globe, Plus, Scissors, Upload } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { addDays, toLocalInput, zonedDate, zonedParts } from "@/lib/dates";
import { formatILS, fullName, toNumber } from "@/lib/utils";
import { bookingAnalytics } from "@/server/services/bookings";
import { hhmm } from "@/domain/booking";
import { ScheduleCalendar, type CalAppt, type CalBlock, type CalDay } from "@/components/bookings/schedule";
import { PageHeader, Stat, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => { const p = zonedParts(d); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };
const minOf = (d: Date) => { const p = zonedParts(d); return p.hour * 60 + p.minute; };
const hmOf = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; week?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("bookings.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const sp = await searchParams;
  const view = sp.view === "day" || sp.view === "3day" || sp.view === "week" ? sp.view : "week";
  const dateStr = [sp.date, sp.week].find((v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  const anchor = dateStr ? (() => { const [y, m, d] = dateStr.split("-").map(Number); return zonedDate(y, m, d, 12); })() : new Date();
  const ap = zonedParts(anchor);
  const anchorDay = zonedDate(ap.year, ap.month, ap.day);
  // Week starts on Sunday (Israel).
  const start = view === "week" ? addDays(anchorDay, -ap.weekday) : anchorDay;
  const count = view === "day" ? 1 : view === "3day" ? 3 : 7;
  const end = addDays(start, count);
  const step = view === "week" ? 7 : count;

  const branch = await db.branch.findFirst({ where: { businessId: user.businessId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const [appts, analytics, rules, offs, services, staff] = await Promise.all([
    db.appointment.findMany({
      where: { businessId: user.businessId, startsAt: { lt: end }, endsAt: { gt: start } },
      orderBy: { startsAt: "asc" },
      include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } }, service: true, staff: { select: { name: true } } },
    }),
    bookingAnalytics(user.businessId),
    branch ? db.availabilityRule.findMany({ where: { branchId: branch.id, staffId: null, isActive: true } }) : [],
    db.timeOff.findMany({ where: { businessId: user.businessId, startsAt: { lt: end }, endsAt: { gt: start } }, include: { staff: { select: { name: true } } } }),
    db.service.findMany({ where: { businessId: user.businessId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }),
    db.user.findMany({ where: { businessId: user.businessId, isActive: true, role: { in: ["OWNER", "MANAGER", "BARBER"] } }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const edit = can(user.role, "bookings.edit");
  const dayNamesHe = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days: CalDay[] = Array.from({ length: count }, (_, i) => {
    const d = addDays(start, i);
    const p = zonedParts(addDays(d, 0));
    const r = rules.filter((x) => x.weekday === p.weekday);
    const opens = r.map((x) => hhmm(x.startTime)).filter((x): x is number => x != null);
    const closes = r.map((x) => hhmm(x.endTime)).filter((x): x is number => x != null);
    return { key: `${p.year}-${pad(p.month)}-${pad(p.day)}`, weekday: p.weekday, short: (he ? dayNamesHe : dayNamesEn)[p.weekday], label: `${pad(p.day)}.${pad(p.month)}`, open: opens.length && closes.length ? [Math.min(...opens), Math.max(...closes)] : null };
  });
  const dayKeys = new Set(days.map((d) => d.key));

  const calAppts: CalAppt[] = appts.filter((a) => dayKeys.has(keyOf(a.startsAt))).map((a) => {
    const sm = minOf(a.startsAt);
    const dur = Math.max(5, Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000));
    const em = Math.min(24 * 60, sm + dur);
    return {
      id: a.id, dayKey: keyOf(a.startsAt), startMin: sm, endMin: em, start: hmOf(sm), end: hmOf(em % (24 * 60)), status: a.status,
      customer: a.customer ? { id: a.customer.id, name: fullName(a.customer), phone: a.customer.phone } : null,
      serviceId: a.serviceId, service: a.service ? (he ? a.service.nameHe : a.service.nameEn) : "", staffId: a.staffId, staff: a.staff?.name ?? null,
      price: a.price == null ? null : toNumber(a.price), paymentStatus: a.paymentStatus, source: a.source, notes: a.notes, startsAtLocal: toLocalInput(a.startsAt), durationMin: dur, cancelReason: a.cancelReason,
    };
  });
  // Blocks are clipped per day.
  const blocks: CalBlock[] = [];
  for (const o of offs) for (const d of days) {
    const [y, m, dd] = d.key.split("-").map(Number);
    const ds = zonedDate(y, m, dd).getTime(), de = ds + 24 * 3600_000;
    const s0 = Math.max(o.startsAt.getTime(), ds), e0 = Math.min(o.endsAt.getTime(), de);
    if (s0 >= e0) continue;
    blocks.push({ id: o.id, dayKey: d.key, startMin: Math.round((s0 - ds) / 60000), endMin: Math.round((e0 - ds) / 60000), reason: o.reason, staff: o.staff?.name ?? null });
  }
  // Visible hours: opening hours of the shown days, extended to include every appointment; default 09:00–21:00.
  const lo = Math.min(...days.flatMap((d) => (d.open ? [d.open[0]] : [])), ...calAppts.map((a) => a.startMin), 9 * 60);
  const hi = Math.max(...days.flatMap((d) => (d.open ? [d.open[1]] : [])), ...calAppts.map((a) => a.endMin), 20 * 60);
  const range: [number, number] = [Math.max(0, Math.floor(lo / 60) * 60 - 60), Math.min(24 * 60, Math.ceil(hi / 60) * 60 + 60)];

  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(he ? "he-IL" : "en-GB", { timeZone: "Asia/Jerusalem", ...o });
  const title = view === "day" ? fmt(start, { weekday: "long", day: "numeric", month: "long" }) : `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(addDays(start, count - 1), { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <PageHeader
        title={t.bookings.title}
        subtitle={t.bookings.subtitle}
        actions={
          <>
            <Link href="/bookings/services" className={buttonClass("secondary")}><Scissors size={14} /> {t.bookings.services}</Link>
            <Link href="/bookings/online" className={buttonClass("secondary")}><Globe size={14} /> {he ? "קביעת תורים אונליין" : "Online booking"}</Link>
            {edit && <Link href="/bookings/import" className={buttonClass("secondary")}><Upload size={14} /> {t.bookings.import}</Link>}
            {edit && <Link href="/bookings/new" className={buttonClass("primary")}><Plus size={14} /> {t.bookings.new}</Link>}
          </>
        }
      />
      <ScheduleCalendar
        view={view} explicitView={Boolean(sp.view)} date={keyOf(start)} prev={keyOf(addDays(start, -step))} next={keyOf(addDays(start, step))} title={title} locale={locale} edit={edit}
        days={days} appts={calAppts} blocks={blocks} range={range}
        services={services.map((s) => ({ id: s.id, name: he ? s.nameHe : s.nameEn, durationMin: s.durationMin, price: toNumber(s.price) }))}
        staff={staff}
      />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={t.bookings.analytics} value={analytics.total} />
        <Stat label={t.bookings.completed} value={analytics.completed} />
        <Stat label={t.bookings.cancellationRate} value={analytics.cancellationRate === null ? "—" : `${analytics.cancellationRate}%`} />
        <Stat label={t.bookings.noShowRate} value={analytics.noShowRate === null ? "—" : `${analytics.noShowRate}%`} />
        <Stat label={t.bookings.completedRevenue} value={formatILS(analytics.completedRevenue, locale)} hint={analytics.avgTicket ? `${t.finance.avgTicket}: ${formatILS(analytics.avgTicket, locale)}` : undefined} />
      </div>
    </>
  );
}
