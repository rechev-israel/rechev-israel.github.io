import Link from "next/link";
import { AlertTriangle, CalendarClock, Cake, GraduationCap, Sparkles, Users, Wallet, ShieldCheck, UserX, TrendingUp } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { getDashboardMetrics, ruleInsights } from "@/server/services/metrics";
import { aiConfigured } from "@/server/ai/provider";
import { fmt } from "@/i18n";
import { formatDateTime, formatILS, fullName } from "@/lib/utils";
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, Stat, buttonClass } from "@/components/ui";
import { RevenueChart } from "@/components/charts";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, t, locale, allowed } = await pageGuard("dashboard.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const m = await getDashboardMetrics(user.businessId);
  const insights = ruleInsights(m);
  const a = m.alerts;
  const alertRows = [
    { n: a.pendingApprovals, text: t.alerts.approvals, href: "/approvals", icon: ShieldCheck, tone: "gold" as const },
    { n: a.atRisk, text: t.alerts.atRisk, href: "/crm?segment=AT_RISK", icon: AlertTriangle, tone: "warning" as const },
    { n: a.birthdays, text: t.alerts.birthdays, href: "/crm/birthdays", icon: Cake, tone: "info" as const },
    { n: a.unpaidStudents, text: t.alerts.unpaid, href: "/academy", icon: Wallet, tone: "warning" as const },
    { n: a.newLeads, text: t.alerts.newLeads, href: "/academy/leads", icon: GraduationCap, tone: "info" as const },
    { n: a.noShows30, text: t.alerts.noShows, href: "/bookings", icon: UserX, tone: "danger" as const },
  ].filter((r) => r.n > 0);
  const toneCls = { gold: "text-gold", warning: "text-warning", info: "text-info", danger: "text-danger" };

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t.dashboard.revenueToday} value={formatILS(m.revenueToday, locale)} icon={<Wallet size={16} />} hint={t.dashboard.actualOnly} />
        <Stat label={t.dashboard.revenueMonth} value={formatILS(m.revenueMonth, locale)} icon={<TrendingUp size={16} />} hint={t.dashboard.actualOnly} />
        <Stat label={t.dashboard.expensesMonth} value={formatILS(m.expensesMonth, locale)} />
        <Stat
          label={t.dashboard.netMonth}
          value={<span className={m.netMonth < 0 ? "text-danger" : ""}>{formatILS(m.netMonth, locale)}</span>}
          hint={m.marginMonth !== null ? `${t.dashboard.margin}: ${m.marginMonth}%` : undefined}
        />
        <Stat label={t.dashboard.appointmentsToday} value={m.apptsToday} icon={<CalendarClock size={16} />} hint={`${t.dashboard.appointmentsWeek}: ${m.apptsWeek}`} />
        <Stat label={t.dashboard.customers} value={m.activeCustomers} icon={<Users size={16} />} hint={`${t.dashboard.newCustomers}: ${m.newCustomers}`} />
        <Stat label={t.dashboard.students} value={m.activeStudents} icon={<GraduationCap size={16} />} />
        <Stat label={t.dashboard.openLeads} value={m.openLeads} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Badge tone="gold">{t.dashboard.actualOnly}</Badge>}>{t.dashboard.revenueTrend}</CardTitle>
          {m.series.some((s) => s.income || s.expense) ? (
            <RevenueChart data={m.series} locale={locale} labels={{ income: t.finance.income, expense: t.finance.expense, net: t.finance.net }} />
          ) : (
            <EmptyState title={t.common.empty}>{t.alerts.noData}</EmptyState>
          )}
        </Card>

        <Card>
          <CardTitle>{t.dashboard.alerts}</CardTitle>
          {alertRows.length ? (
            <ul className="space-y-2">
              {alertRows.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm hover:border-gold/40">
                    <r.icon size={16} className={`mt-0.5 shrink-0 ${toneCls[r.tone]}`} />
                    <span>{fmt(r.text, { n: r.n })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t.common.none} />
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle action={<Link href="/bookings" className="text-xs text-gold hover:underline">{t.common.view}</Link>}>{t.dashboard.upcoming}</CardTitle>
          {m.upcoming.length ? (
            <ul className="divide-y divide-border">
              {m.upcoming.map((ap) => (
                <li key={ap.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ap.customer ? fullName(ap.customer) : t.bookings.walkIn}</p>
                    <p className="truncate text-xs text-muted">{ap.service ? (locale === "he" ? ap.service.nameHe : ap.service.nameEn) : "—"}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{formatDateTime(ap.startsAt, locale)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t.common.empty} />
          )}
        </Card>

        <Card>
          <CardTitle action={<Link href="/tasks" className="text-xs text-gold hover:underline">{t.common.view}</Link>}>{t.dashboard.tasks}</CardTitle>
          {m.openTasks.length ? (
            <ul className="space-y-2">
              {m.openTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="truncate">{task.title}</span>
                  <Badge tone={task.priority === 1 ? "danger" : task.priority === 2 ? "neutral" : "info"}>
                    {task.priority === 1 ? t.tasks.high : task.priority === 2 ? t.tasks.normal : t.tasks.low}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t.common.empty} />
          )}
        </Card>

        <Card>
          <CardTitle action={<Sparkles size={16} className="text-gold" />}>{t.dashboard.insights}</CardTitle>
          {!aiConfigured() && <Notice tone="neutral" className="mb-3">{t.dashboard.noAi}</Notice>}
          {insights.length ? (
            <ul className="space-y-2 text-sm">
              {insights.map((i, idx) => (
                <li key={idx} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 leading-relaxed">
                  <Badge tone={i.level === "warn" ? "warning" : i.level === "good" ? "success" : "info"} className="mb-1">{i.level === "warn" ? "!" : i.level === "good" ? "✓" : "i"}</Badge>
                  <p>{locale === "he" ? i.he : i.en}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t.alerts.noData} />
          )}
          <Link href="/agents" className={buttonClass("outline", "sm", "mt-3 w-full")}>{t.nav.agents}</Link>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardTitle>{t.dashboard.marketing}</CardTitle>
          <Notice tone="neutral">{t.dashboard.marketingNA} <Link className="text-gold underline" href="/integrations">{t.nav.integrations}</Link></Notice>
        </Card>
      </section>
    </>
  );
}
