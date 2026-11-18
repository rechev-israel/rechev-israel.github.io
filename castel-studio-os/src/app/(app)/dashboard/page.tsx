import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, Cake, GraduationCap, Settings2, ShieldCheck, Sparkles, TrendingUp, UserX, Users, Wallet, MessageCircle, Workflow } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { getDashboardMetrics, ruleInsights } from "@/server/services/metrics";
import { aiConfigured } from "@/server/ai/provider";
import { saveWidgetsAction, generateInsightsAction } from "@/server/actions/dashboard";
import { WIDGET_IDS, visibleWidgets, type WidgetId } from "@/lib/widgets";
import { fmt } from "@/i18n";
import { formatDateTime, formatILS, fullName, toNumber } from "@/lib/utils";
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, Stat, buttonClass } from "@/components/ui";
import { RevenueChart } from "@/components/charts";
import { InsightsButton } from "@/components/dashboard/insights-button";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, t, locale, allowed } = await pageGuard("dashboard.view");
  if (allowed) await (await import("@/server/services/bookings")).autoCompletePastAppointments(user.businessId).catch(() => 0);
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const me = await db.user.findUnique({ where: { id: user.id }, select: { dashboardWidgets: true } });
  const show = visibleWidgets(me?.dashboardWidgets);
  const on = (w: WidgetId) => show.has(w);

  const [m, notes, lastInsight, pendingMsgs, autoFails, campaigns, enrollAgg] = await Promise.all([
    getDashboardMetrics(user.businessId),
    on("notifications") ? db.notification.findMany({ where: { businessId: user.businessId, readAt: null, OR: [{ userId: null }, { userId: user.id }], kind: { not: "ai_insight" } }, orderBy: { createdAt: "desc" }, take: 5 }) : [],
    db.notification.findFirst({ where: { businessId: user.businessId, kind: "ai_insight" }, orderBy: { createdAt: "desc" } }),
    db.outboundMessage.count({ where: { businessId: user.businessId, status: "PENDING_APPROVAL" } }),
    db.automationRun.count({ where: { businessId: user.businessId, status: { in: ["failed", "retrying"] }, startedAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    on("marketing") ? db.campaign.findMany({ where: { businessId: user.businessId, status: { in: ["live", "approved", "pending_approval"] } }, take: 5, orderBy: { updatedAt: "desc" } }) : [],
    on("academy") ? db.enrollment.groupBy({ by: ["status"], where: { cohort: { course: { businessId: user.businessId } } }, _count: true }) : [],
  ]);
  const insights = ruleInsights(m);
  const a = m.alerts;
  const alertRows = [
    { n: a.pendingApprovals, text: t.alerts.approvals, href: "/approvals", icon: ShieldCheck, tone: "gold" as const },
    { n: pendingMsgs, text: L("{n} הודעות ללקוחות ממתינות לאישורך", "{n} customer messages await your approval"), href: "/communications", icon: MessageCircle, tone: "gold" as const },
    { n: autoFails, text: L("{n} ריצות אוטומציה נכשלו השבוע", "{n} automation runs failed this week"), href: "/automations", icon: Workflow, tone: "danger" as const },
    { n: a.atRisk, text: t.alerts.atRisk, href: "/crm?segment=AT_RISK", icon: AlertTriangle, tone: "warning" as const },
    { n: a.birthdays, text: t.alerts.birthdays, href: "/crm/birthdays", icon: Cake, tone: "info" as const },
    { n: a.unpaidStudents, text: t.alerts.unpaid, href: "/academy", icon: Wallet, tone: "warning" as const },
    { n: a.newLeads, text: t.alerts.newLeads, href: "/academy/leads", icon: GraduationCap, tone: "info" as const },
    { n: a.noShows30, text: t.alerts.noShows, href: "/bookings", icon: UserX, tone: "danger" as const },
  ].filter((r) => r.n > 0);
  const toneCls = { gold: "text-gold", warning: "text-warning", info: "text-info", danger: "text-danger" };
  const widgetLabel: Record<WidgetId, string> = {
    kpis: L("מדדים מרכזיים", "Key metrics"), trend: L("מגמת הכנסות", "Revenue trend"), alerts: t.dashboard.alerts, notifications: L("התראות", "Notifications"),
    upcoming: t.dashboard.upcoming, tasks: t.dashboard.tasks, insights: t.dashboard.insights, academy: L("האקדמיה", "Academy"), marketing: t.dashboard.marketing,
  };
  const enr = (s: string) => enrollAgg.find((x) => x.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      {on("kpis") && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={t.dashboard.revenueToday} value={formatILS(m.revenueToday, locale)} icon={<Wallet size={16} />} hint={t.dashboard.actualOnly} />
          <Stat label={t.dashboard.revenueMonth} value={formatILS(m.revenueMonth, locale)} icon={<TrendingUp size={16} />} hint={t.dashboard.actualOnly} />
          <Stat label={t.dashboard.expensesMonth} value={formatILS(m.expensesMonth, locale)} />
          <Stat label={t.dashboard.netMonth} value={<span className={m.netMonth < 0 ? "text-danger" : ""}>{formatILS(m.netMonth, locale)}</span>} hint={m.marginMonth !== null ? `${t.dashboard.margin}: ${m.marginMonth}%` : undefined} />
          <Stat label={t.dashboard.appointmentsToday} value={m.apptsToday} icon={<CalendarClock size={16} />} hint={`${t.dashboard.appointmentsWeek}: ${m.apptsWeek}`} />
          <Stat label={t.dashboard.customers} value={m.activeCustomers} icon={<Users size={16} />} hint={`${t.dashboard.newCustomers}: ${m.newCustomers}`} />
          <Stat label={t.dashboard.students} value={m.activeStudents} icon={<GraduationCap size={16} />} />
          <Stat label={t.dashboard.openLeads} value={m.openLeads} />
        </section>
      )}

      {(on("trend") || on("alerts")) && (
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          {on("trend") && (
            <Card className={on("alerts") ? "lg:col-span-2" : "lg:col-span-3"}>
              <CardTitle action={<Badge tone="gold">{t.dashboard.actualOnly}</Badge>}>{t.dashboard.revenueTrend}</CardTitle>
              {m.series.some((s) => s.income || s.expense) ? <RevenueChart data={m.series} locale={locale} labels={{ income: t.finance.income, expense: t.finance.expense, net: t.finance.net }} /> : <EmptyState title={t.common.empty}>{t.alerts.noData}</EmptyState>}
            </Card>
          )}
          {on("alerts") && (
            <Card className={on("trend") ? "" : "lg:col-span-3"}>
              <CardTitle>{t.dashboard.alerts}</CardTitle>
              {alertRows.length ? (
                <ul className="space-y-2">
                  {alertRows.map((r) => (
                    <li key={r.href}><Link href={r.href} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm hover:border-gold/40"><r.icon size={16} className={`mt-0.5 shrink-0 ${toneCls[r.tone]}`} /><span>{fmt(r.text, { n: r.n })}</span></Link></li>
                  ))}
                </ul>
              ) : <EmptyState title={t.common.none} />}
            </Card>
          )}
        </section>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {on("notifications") && (
          <Card>
            <CardTitle action={<Link href="/notifications" className="-my-2 inline-flex min-h-9 items-center px-2 text-xs text-gold hover:underline">{t.common.view}</Link>}><span className="inline-flex items-center gap-2"><Bell size={15} className="text-gold" /> {widgetLabel.notifications}</span></CardTitle>
            {notes.length ? (
              <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm"><p className="font-medium">{n.title}</p>{n.body && <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted">{n.body}</p>}<p className="mt-1 text-[10px] text-muted">{formatDateTime(n.createdAt, locale)}</p></li>)}</ul>
            ) : <EmptyState title={L("אין התראות חדשות", "No new notifications")} />}
          </Card>
        )}
        {on("upcoming") && (
          <Card>
            <CardTitle action={<Link href="/bookings" className="-my-2 inline-flex min-h-9 items-center px-2 text-xs text-gold hover:underline">{t.common.view}</Link>}>{t.dashboard.upcoming}</CardTitle>
            {m.upcoming.length ? (
              <ul className="divide-y divide-border">{m.upcoming.map((ap) => (
                <li key={ap.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="min-w-0"><p className="truncate font-medium">{ap.customer ? fullName(ap.customer) : t.bookings.walkIn}</p><p className="truncate text-xs text-muted">{ap.service ? (locale === "he" ? ap.service.nameHe : ap.service.nameEn) : "—"}</p></div><span className="shrink-0 text-xs tabular-nums text-muted">{formatDateTime(ap.startsAt, locale)}</span></li>
              ))}</ul>
            ) : <EmptyState title={t.common.empty} />}
          </Card>
        )}
        {on("tasks") && (
          <Card>
            <CardTitle action={<Link href="/tasks" className="-my-2 inline-flex min-h-9 items-center px-2 text-xs text-gold hover:underline">{t.common.view}</Link>}>{t.dashboard.tasks}</CardTitle>
            {m.openTasks.length ? (
              <ul className="space-y-2">{m.openTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="truncate">{task.title}</span><Badge tone={task.priority === 1 ? "danger" : task.priority === 2 ? "neutral" : "info"}>{task.priority === 1 ? t.tasks.high : task.priority === 2 ? t.tasks.normal : t.tasks.low}</Badge></li>
              ))}</ul>
            ) : <EmptyState title={t.common.empty} />}
          </Card>
        )}
        {on("insights") && (
          <Card>
            <CardTitle action={<Sparkles size={16} className="text-gold" />}>{t.dashboard.insights}</CardTitle>
            {lastInsight ? (
              <div className="rounded-lg border border-gold/30 bg-gold-soft/40 p-3 text-sm">
                <p className="mb-1 text-[10px] text-gold">{L("נוצר על ידי AI", "AI-generated")} · {formatDateTime(lastInsight.createdAt, locale)}</p>
                <p className="line-clamp-[12] whitespace-pre-wrap leading-relaxed">{lastInsight.body}</p>
              </div>
            ) : !aiConfigured() ? <Notice tone="neutral" className="mb-3">{t.dashboard.noAi}</Notice> : null}
            {insights.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {insights.map((i, idx) => <li key={idx} className="rounded-lg border border-border bg-surface-2 px-3 py-2 leading-relaxed"><Badge tone={i.level === "warn" ? "warning" : i.level === "good" ? "success" : "info"} className="me-1">{L("כלל", "Rule")}</Badge>{locale === "he" ? i.he : i.en}</li>)}
              </ul>
            )}
            {can(user.role, "ai.use") && <InsightsButton action={generateInsightsAction} disabled={!aiConfigured()} label={L("הפקת תובנות AI עכשיו", "Generate AI insights now")} />}
          </Card>
        )}
        {on("academy") && (
          <Card>
            <CardTitle action={<Link href="/academy" className="-my-2 inline-flex min-h-9 items-center px-2 text-xs text-gold hover:underline">{t.common.view}</Link>}>{widgetLabel.academy}</CardTitle>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">{t.dashboard.students}</dt><dd className="text-xl font-semibold">{m.activeStudents}</dd></div>
              <div><dt className="text-xs text-muted">{t.dashboard.openLeads}</dt><dd className="text-xl font-semibold">{m.openLeads}</dd></div>
              <div><dt className="text-xs text-muted">{L("רישומים מאושרים", "Confirmed enrollments")}</dt><dd className="text-xl font-semibold">{enr("CONFIRMED")}</dd></div>
              <div><dt className="text-xs text-muted">{L("בוגרים", "Graduates")}</dt><dd className="text-xl font-semibold">{enr("COMPLETED")}</dd></div>
            </dl>
            {a.unpaidStudents > 0 && <p className="mt-3 text-xs text-warning">{fmt(t.alerts.unpaid, { n: a.unpaidStudents })}</p>}
          </Card>
        )}
        {on("marketing") && (
          <Card>
            <CardTitle action={<Link href="/marketing" className="-my-2 inline-flex min-h-9 items-center px-2 text-xs text-gold hover:underline">{t.common.view}</Link>}>{t.dashboard.marketing}</CardTitle>
            {campaigns.length ? (
              <ul className="space-y-2 text-sm">{campaigns.map((c) => (
                <li key={c.id} className="rounded-lg bg-surface-2 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{c.name}</span><Badge tone={c.status === "live" ? "success" : "gold"}>{c.status}</Badge></div>
                  <p className="text-[11px] text-muted">{c.channel} · {c.leads ?? "—"} {L("לידים", "leads")} · {c.spendActual ? formatILS(toNumber(c.spendActual), locale) : "—"} <span className="text-muted/70">({L("ידני", "manual")})</span></p></li>
              ))}</ul>
            ) : <EmptyState title={L("אין קמפיינים פעילים", "No active campaigns")}><Link href="/marketing?tab=campaigns" className="text-gold underline">{L("יצירת קמפיין", "Create a campaign")}</Link></EmptyState>}
          </Card>
        )}
      </section>

      <details className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm text-muted"><Settings2 size={15} /> {L("התאמת הווידג׳טים בלוח", "Customise dashboard widgets")}</summary>
        <form action={saveWidgetsAction} className="mt-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {WIDGET_IDS.map((w) => (
              <label key={w} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm has-[:checked]:border-gold/50">
                <input type="checkbox" name="w" value={w} defaultChecked={on(w)} className="h-4 w-4 accent-[var(--gold)]" /> {widgetLabel[w]}
              </label>
            ))}
          </div>
          <button className={buttonClass("secondary", "sm", "mt-3")}>{t.common.save}</button>
        </form>
      </details>
    </>
  );
}
