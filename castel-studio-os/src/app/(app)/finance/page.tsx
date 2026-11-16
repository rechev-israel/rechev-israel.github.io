import Link from "next/link";
import { Download, FileText, Trash2 } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { addMonths, startOfMonth, toLocalInput } from "@/lib/dates";
import { formatDate, formatILS, toNumber } from "@/lib/utils";
import { byCategory, margin, monthlySeries, naiveForecast, priceScenario, summarize } from "@/domain/finance";
import { getTransactions, lastMonths } from "@/server/services/metrics";
import { createTransactionAction, deleteTransactionAction } from "@/server/actions/finance";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/validation";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Button, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { CategoryBars, RevenueChart } from "@/components/charts";
import { Forbidden } from "@/components/forbidden";
import { fmt } from "@/i18n";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string; price?: string; volume?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("finance.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const sp = await searchParams;
  const now = new Date();
  const monthStart = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? startOfMonth(new Date(sp.month + "-15T12:00:00Z")) : startOfMonth(now);
  const monthEnd = addMonths(monthStart, 1);
  const [txs12, monthRows] = await Promise.all([
    getTransactions(user.businessId, addMonths(startOfMonth(now), -11)),
    db.transaction.findMany({ where: { businessId: user.businessId, occurredAt: { gte: monthStart, lt: monthEnd } }, orderBy: { occurredAt: "desc" }, include: { payment: { select: { id: true } } } }),
  ]);
  const monthTx = monthRows.map((r) => ({ ...r, amount: toNumber(r.amount) }));
  const sum = summarize(monthTx);
  const series = monthlySeries(txs12, lastMonths(12, now));
  const forecast = naiveForecast(series.slice(-4, -1));
  const catLabel = (c: string) => (t.txCategories as Record<string, string>)[c] ?? c;
  const incomeCats = byCategory(monthTx, "INCOME").map((c) => ({ label: catLabel(c.category), amount: c.amount }));
  const expenseCats = byCategory(monthTx, "EXPENSE").map((c) => ({ label: catLabel(c.category), amount: c.amount }));
  const baseRevenue = forecast?.income ?? sum.actual.income;
  const priceChange = Number(sp.price ?? 10) || 0;
  const volumeChange = Number(sp.volume ?? -5) || 0;
  const edit = can(user.role, "finance.edit");
  const mKey = toLocalInput(monthStart, false).slice(0, 7);
  const prev = toLocalInput(addMonths(monthStart, -1), false).slice(0, 7);
  const next = toLocalInput(addMonths(monthStart, 1), false).slice(0, 7);

  return (
    <>
      <PageHeader
        title={t.finance.title}
        subtitle={t.finance.subtitle}
        actions={
          <>
            <Link href={`/finance/report?month=${mKey}`} className={buttonClass("secondary")}><FileText size={14} /> {t.finance.printReport}</Link>
            <a href={`/api/finance/export?from=${mKey}-01&to=${toLocalInput(addMonths(monthStart, 1), false)}`} className={buttonClass("secondary")}><Download size={14} /> {t.common.exportCsv}</a>
          </>
        }
      />
      <Notice tone="warning" className="mb-4">{t.finance.disclaimer}</Notice>

      <div className="mb-3 flex items-center gap-2">
        <Link href={`/finance?month=${prev}`} className={buttonClass("ghost", "sm")}>‹</Link>
        <p className="font-display text-lg tabular-nums">{t.finance.month}: {mKey}</p>
        <Link href={`/finance?month=${next}`} className={buttonClass("ghost", "sm")}>›</Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`${t.finance.income} (${t.finance.actual})`} value={formatILS(sum.actual.income, locale)} />
        <Stat label={`${t.finance.expense} (${t.finance.actual})`} value={formatILS(sum.actual.expense, locale)} />
        <Stat label={`${t.finance.net} (${t.finance.actual})`} value={<span className={sum.actual.net < 0 ? "text-danger" : ""}>{formatILS(sum.actual.net, locale)}</span>} hint={margin(sum.actual.income, sum.actual.expense) !== null ? `${t.dashboard.margin}: ${margin(sum.actual.income, sum.actual.expense)}%` : undefined} />
        <Stat label={`${t.finance.net} (${t.finance.estimate})`} value={<span className="text-muted">{formatILS(sum.estimate.net, locale)}</span>} hint={`${t.finance.income} ${formatILS(sum.estimate.income, locale)} · ${t.finance.expense} ${formatILS(sum.estimate.expense, locale)}`} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Badge tone="gold">{t.dashboard.actualOnly}</Badge>}>{t.finance.cashflow} · 12m</CardTitle>
          <RevenueChart data={series} locale={locale} labels={{ income: t.finance.income, expense: t.finance.expense, net: t.finance.net }} />
        </Card>
        <Card>
          <CardTitle action={<Badge tone="info">{t.finance.estimate}</Badge>}>{t.finance.forecast}</CardTitle>
          {forecast ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t.finance.income}</dt><dd className="tabular-nums">{formatILS(forecast.income, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t.finance.expense}</dt><dd className="tabular-nums">{formatILS(forecast.expense, locale)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>{t.finance.net}</dt><dd className="tabular-nums">{formatILS(forecast.net, locale)}</dd></div>
              <p className="text-[11px] text-muted">{fmt(t.finance.basedOn, { n: forecast.basedOnMonths })}</p>
            </dl>
          ) : <EmptyState title={t.finance.forecastNA} />}
          <div className="gold-rule my-4 opacity-40" />
          <CardTitle>{t.finance.scenario}</CardTitle>
          <form className="grid grid-cols-2 gap-2" action="/finance">
            <input type="hidden" name="month" value={mKey} />
            <div><Label>{t.finance.priceChange}</Label><Input name="price" type="number" defaultValue={priceChange} min={-90} max={300} /></div>
            <div><Label>{t.finance.volumeChange}</Label><Input name="volume" type="number" defaultValue={volumeChange} min={-90} max={300} /></div>
            <Button type="submit" variant="secondary" size="sm" className="col-span-2">↻</Button>
          </form>
          <p className="mt-3 text-xs text-muted">{t.finance.baseRevenue}: {formatILS(baseRevenue, locale)}</p>
          <p className="text-sm">{t.finance.projected}: <span className="font-semibold text-gold">{formatILS(priceScenario({ baseRevenue, priceChangePct: priceChange, volumeChangePct: volumeChange }), locale)}</span> <Badge tone="info">{t.finance.estimate}</Badge></p>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card><CardTitle>{t.finance.income} · {t.finance.byCategory}</CardTitle>{incomeCats.length ? <CategoryBars data={incomeCats} locale={locale} /> : <EmptyState title={t.common.empty} />}</Card>
        <Card><CardTitle>{t.finance.expense} · {t.finance.byCategory}</CardTitle>{expenseCats.length ? <CategoryBars data={expenseCats} locale={locale} /> : <EmptyState title={t.common.empty} />}</Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {edit && (
          <Card>
            <CardTitle>{t.finance.newTx}</CardTitle>
            <ActionForm action={createTransactionAction} resetOnSuccess className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t.finance.type}</Label><Select name="type"><option value="INCOME">{t.finance.income}</option><option value="EXPENSE">{t.finance.expense}</option></Select></div>
                <div><Label>{t.finance.kind}</Label><Select name="kind"><option value="ACTUAL">{t.finance.actual}</option><option value="ESTIMATE">{t.finance.estimate}</option></Select></div>
              </div>
              <div>
                <Label>{t.common.category}</Label>
                <Select name="category">
                  <optgroup label={t.finance.income}>{INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</optgroup>
                  <optgroup label={t.finance.expense}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</optgroup>
                </Select>
                <FieldError name="category" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t.common.amount} ₪</Label><Input name="amount" type="number" min={0.01} step="0.01" required /><FieldError name="amount" /></div>
                <div><Label>{t.finance.occurredAt}</Label><Input name="occurredAt" type="date" required defaultValue={toLocalInput(now, false)} /></div>
              </div>
              <div><Label>{t.finance.method}</Label><Select name="method"><option value="">—</option>{(["CASH", "CREDIT_CARD", "BANK_TRANSFER", "BIT", "PAYBOX", "OTHER"] as const).map((m) => <option key={m} value={m}>{t.paymentMethod[m]}</option>)}</Select></div>
              <div><Label>{t.common.description}</Label><Input name="description" /></div>
              <SubmitButton className="w-full">{t.common.add}</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <Card className={edit ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardTitle>{t.finance.monthly}</CardTitle>
          {monthTx.length ? (
            <Table>
              <thead><tr><Th>{t.common.date}</Th><Th>{t.finance.type}</Th><Th>{t.common.category}</Th><Th>{t.common.description}</Th><Th className="text-end">{t.common.amount}</Th><Th /></tr></thead>
              <tbody>
                {monthTx.map((x) => (
                  <tr key={x.id}>
                    <Td className="tabular-nums text-muted">{formatDate(x.occurredAt, locale)}</Td>
                    <Td><Badge tone={x.type === "INCOME" ? "success" : "danger"}>{x.type === "INCOME" ? t.finance.income : t.finance.expense}</Badge>{x.kind === "ESTIMATE" && <Badge tone="info" className="ms-1">{t.finance.estimate}</Badge>}</Td>
                    <Td>{catLabel(x.category)}</Td>
                    <Td className="max-w-56 truncate text-xs text-muted">{x.description ?? ""}</Td>
                    <Td className={`text-end tabular-nums ${x.type === "EXPENSE" ? "text-danger" : ""}`}>{x.type === "EXPENSE" ? "−" : ""}{formatILS(x.amount, locale)}</Td>
                    <Td className="w-8">{edit && !x.payment && <InlineAction action={deleteTransactionAction} fields={{ id: x.id }} confirm={t.common.delete + "?"}><Trash2 size={12} /></InlineAction>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title={t.common.empty} />}
        </Card>
      </div>
    </>
  );
}
