import { monthKey } from "@/lib/dates";

export type Tx = { type: "INCOME" | "EXPENSE"; kind: "ACTUAL" | "ESTIMATE"; amount: number; occurredAt: Date; category: string };

export function summarize(txs: Tx[]) {
  const out = {
    actual: { income: 0, expense: 0, net: 0 },
    estimate: { income: 0, expense: 0, net: 0 },
  };
  for (const t of txs) {
    const bucket = t.kind === "ACTUAL" ? out.actual : out.estimate;
    if (t.type === "INCOME") bucket.income += t.amount;
    else bucket.expense += t.amount;
  }
  out.actual.net = out.actual.income - out.actual.expense;
  out.estimate.net = out.estimate.income - out.estimate.expense;
  return out;
}

export function margin(income: number, expense: number) {
  if (income <= 0) return null;
  return Math.round(((income - expense) / income) * 1000) / 10;
}

/** Monthly series of ACTUAL transactions only. */
export function monthlySeries(txs: Tx[], months: string[]) {
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0, net: 0 }]));
  for (const t of txs) {
    if (t.kind !== "ACTUAL") continue;
    const row = map.get(monthKey(t.occurredAt));
    if (!row) continue;
    if (t.type === "INCOME") row.income += t.amount;
    else row.expense += t.amount;
  }
  for (const r of map.values()) r.net = r.income - r.expense;
  return [...map.values()];
}

export function byCategory(txs: Tx[], type: "INCOME" | "EXPENSE") {
  const m = new Map<string, number>();
  for (const t of txs) if (t.type === type && t.kind === "ACTUAL") m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/**
 * Naive forecast: average of the last N complete months of actuals. Always labelled as an ESTIMATE.
 * Returns null if there is not enough history (no fabricated numbers).
 */
export function naiveForecast(series: { income: number; expense: number }[], minMonths = 2) {
  const withData = series.filter((s) => s.income > 0 || s.expense > 0);
  if (withData.length < minMonths) return null;
  const avg = (k: "income" | "expense") => withData.reduce((s, r) => s + r[k], 0) / withData.length;
  const income = Math.round(avg("income"));
  const expense = Math.round(avg("expense"));
  return { income, expense, net: income - expense, basedOnMonths: withData.length };
}

/** Scenario: how revenue changes with price and volume deltas (percent). */
export function priceScenario(input: { baseRevenue: number; priceChangePct: number; volumeChangePct: number }) {
  const r = input.baseRevenue * (1 + input.priceChangePct / 100) * (1 + input.volumeChangePct / 100);
  return Math.round(r);
}
