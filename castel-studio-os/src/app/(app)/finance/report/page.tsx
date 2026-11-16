import { pageGuard } from "@/server/auth/guard";
import { addMonths, startOfMonth, toLocalInput } from "@/lib/dates";
import { formatILS } from "@/lib/utils";
import { byCategory, margin, summarize } from "@/domain/finance";
import { getTransactions } from "@/server/services/metrics";
import { Forbidden } from "@/components/forbidden";
import { PrintButton } from "@/components/print-button";
import { Table, Td, Th } from "@/components/ui";

export default async function FinanceReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("finance.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const sp = await searchParams;
  const start = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? startOfMonth(new Date(sp.month + "-15T12:00:00Z")) : startOfMonth();
  const txs = await getTransactions(user.businessId, start, addMonths(start, 1));
  const s = summarize(txs);
  const catLabel = (c: string) => (t.txCategories as Record<string, string>)[c] ?? c;
  const Section = ({ type }: { type: "INCOME" | "EXPENSE" }) => (
    <Table className="print-plain">
      <thead><tr><Th>{type === "INCOME" ? t.finance.income : t.finance.expense}</Th><Th className="text-end">{t.common.amount}</Th></tr></thead>
      <tbody>{byCategory(txs, type).map((c) => <tr key={c.category}><Td>{catLabel(c.category)}</Td><Td className="text-end tabular-nums">{formatILS(c.amount, locale)}</Td></tr>)}</tbody>
    </Table>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="no-print flex justify-end"><PrintButton label={`${t.common.print} / PDF`} /></div>
      <header>
        <p className="text-xs tracking-[0.3em] text-gold">CASTEL STUDIO</p>
        <h1 className="font-display text-3xl font-bold">{t.finance.monthly} — {toLocalInput(start, false).slice(0, 7)}</h1>
        <p className="mt-2 text-xs text-muted">{t.finance.disclaimer}</p>
      </header>
      <Table className="print-plain">
        <thead><tr><Th /><Th className="text-end">{t.finance.actual}</Th><Th className="text-end">{t.finance.estimate}</Th></tr></thead>
        <tbody>
          <tr><Td>{t.finance.income}</Td><Td className="text-end tabular-nums">{formatILS(s.actual.income, locale)}</Td><Td className="text-end tabular-nums text-muted">{formatILS(s.estimate.income, locale)}</Td></tr>
          <tr><Td>{t.finance.expense}</Td><Td className="text-end tabular-nums">{formatILS(s.actual.expense, locale)}</Td><Td className="text-end tabular-nums text-muted">{formatILS(s.estimate.expense, locale)}</Td></tr>
          <tr className="font-semibold"><Td>{t.finance.net}</Td><Td className="text-end tabular-nums">{formatILS(s.actual.net, locale)}</Td><Td className="text-end tabular-nums text-muted">{formatILS(s.estimate.net, locale)}</Td></tr>
          <tr><Td>{t.dashboard.margin}</Td><Td className="text-end">{margin(s.actual.income, s.actual.expense) ?? "—"}%</Td><Td /></tr>
        </tbody>
      </Table>
      <div className="grid gap-4 md:grid-cols-2"><Section type="INCOME" /><Section type="EXPENSE" /></div>
      <p className="text-[10px] text-muted">Generated {new Date().toISOString()} · {user.name}</p>
    </div>
  );
}
