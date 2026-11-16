import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { addMonths, monthKey, startOfMonth } from "@/lib/dates";
import { monthlySeries } from "@/domain/finance";
import { getTransactions, lastMonths } from "@/server/services/metrics";
import { bookingAnalytics } from "@/server/services/bookings";
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { CategoryBars, RevenueChart } from "@/components/charts";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { user, t, locale, allowed } = await pageGuard("dashboard.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const since = addMonths(startOfMonth(), -5);
  const months = lastMonths(6);
  const [txs, segments, leads, enrollments, b30, b90] = await Promise.all([
    getTransactions(user.businessId, since),
    db.customer.groupBy({ by: ["status"], where: { businessId: user.businessId, archivedAt: null }, _count: true }),
    db.lead.findMany({ where: { businessId: user.businessId, createdAt: { gte: since } }, select: { createdAt: true, source: true, status: true } }),
    db.enrollment.findMany({ where: { cohort: { course: { businessId: user.businessId } }, createdAt: { gte: since } }, select: { createdAt: true, status: true } }),
    bookingAnalytics(user.businessId, 30),
    bookingAnalytics(user.businessId, 90),
  ]);
  const totalCustomers = segments.reduce((s, x) => s + x._count, 0);
  const retained = segments.filter((s) => s.status === "ACTIVE" || s.status === "VIP").reduce((s, x) => s + x._count, 0);
  const leadSources = Object.entries(leads.reduce<Record<string, number>>((a, l) => ((a[l.source ?? "—"] = (a[l.source ?? "—"] ?? 0) + 1), a), {})).map(([label, amount]) => ({ label, amount }));
  const converted = leads.filter((l) => l.status === "ENROLLED" || l.status === "QUALIFIED").length;
  const perMonth = months.map((m) => ({ m, leads: leads.filter((l) => monthKey(l.createdAt) === m).length, enrollments: enrollments.filter((e) => monthKey(e.createdAt) === m && e.status !== "CANCELLED").length }));
  return (
    <>
      <PageHeader title={t.nav.analytics} actions={<Badge tone="info" className="h-8 px-3">{locale === "he" ? "חלקי — ניתוח AI ומדדי קמפיינים בשלב 3" : "Partial — AI analysis & campaign metrics in Phase 3"}</Badge>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={locale === "he" ? "שימור לקוחות (פעיל+VIP)" : "Retention (active+VIP)"} value={totalCustomers ? `${Math.round((retained / totalCustomers) * 100)}%` : "—"} hint={`${retained}/${totalCustomers}`} />
        <Stat label={locale === "he" ? "המרת לידים (6 ח׳)" : "Lead conversion (6m)"} value={leads.length ? `${Math.round((converted / leads.length) * 100)}%` : "—"} hint={`${converted}/${leads.length}`} />
        <Stat label={`${t.bookings.noShowRate} 30/90`} value={`${b30.noShowRate ?? "—"}% / ${b90.noShowRate ?? "—"}%`} />
        <Stat label={`${t.bookings.cancellationRate} 30/90`} value={`${b30.cancellationRate ?? "—"}% / ${b90.cancellationRate ?? "—"}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardTitle>{t.dashboard.revenueTrend}</CardTitle><RevenueChart data={monthlySeries(txs, months)} locale={locale} labels={{ income: t.finance.income, expense: t.finance.expense, net: t.finance.net }} /></Card>
        <Card>
          <CardTitle>{t.crm.segment}</CardTitle>
          {segments.length ? <CategoryBars data={segments.map((s) => ({ label: t.segments[s.status], amount: s._count }))} locale="raw" /> : <EmptyState title={t.common.empty} />}
        </Card>
        <Card>
          <CardTitle>{t.academy.leads} / {t.academy.enrolled}</CardTitle>
          <Table><thead><tr><Th>{t.finance.month}</Th><Th className="text-end">{t.academy.leads}</Th><Th className="text-end">{t.academy.enrolled}</Th></tr></thead>
            <tbody>{perMonth.map((r) => <tr key={r.m}><Td className="tabular-nums">{r.m}</Td><Td className="text-end">{r.leads}</Td><Td className="text-end">{r.enrollments}</Td></tr>)}</tbody></Table>
        </Card>
        <Card><CardTitle>{t.common.source}</CardTitle>{leadSources.length ? <CategoryBars data={leadSources} locale="raw" /> : <EmptyState title={t.common.empty} />}</Card>
      </div>
      <Notice tone="neutral" className="mt-4">{t.dashboard.marketingNA}</Notice>
    </>
  );
}
