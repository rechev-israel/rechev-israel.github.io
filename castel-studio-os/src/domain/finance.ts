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

/**
 * Profit & loss matrix (ACTUAL only): one row per category, grouped as income then expense,
 * followed by total income, total expense, net and margin %.
 */
export function profitAndLoss(txs: Tx[], months: string[]) {
  const idx = new Map(months.map((m, i) => [m, i]));
  const cats = new Map<string, { type: "INCOME" | "EXPENSE"; values: number[] }>();
  for (const t of txs) {
    if (t.kind !== "ACTUAL") continue;
    const i = idx.get(monthKey(t.occurredAt));
    if (i === undefined) continue;
    const key = `${t.type}:${t.category}`;
    if (!cats.has(key)) cats.set(key, { type: t.type, values: months.map(() => 0) });
    cats.get(key)!.values[i] += t.amount;
  }
  const sum = (vs: number[][]) => months.map((_, i) => vs.reduce((s, v) => s + v[i], 0));
  const income = [...cats.entries()].filter(([, v]) => v.type === "INCOME");
  const expense = [...cats.entries()].filter(([, v]) => v.type === "EXPENSE");
  const totIn = sum(income.map(([, v]) => v.values));
  const totEx = sum(expense.map(([, v]) => v.values));
  const net = totIn.map((v, i) => v - totEx[i]);
  const total = (vs: number[]) => Math.round(vs.reduce((a, b) => a + b, 0) * 100) / 100;
  const round = (vs: number[]) => vs.map((v) => Math.round(v * 100) / 100);
  const rows = [
    ...income.map(([k, v]) => ({ label: k.split(":")[1], group: "income" as const, values: round(v.values), total: total(v.values) })),
    { label: "TOTAL_INCOME", group: "total" as const, values: round(totIn), total: total(totIn) },
    ...expense.map(([k, v]) => ({ label: k.split(":")[1], group: "expense" as const, values: round(v.values), total: total(v.values) })),
    { label: "TOTAL_EXPENSE", group: "total" as const, values: round(totEx), total: total(totEx) },
    { label: "NET", group: "total" as const, values: round(net), total: total(net) },
  ];
  const marginPct = months.map((_, i) => (totIn[i] > 0 ? Math.round((net[i] / totIn[i]) * 1000) / 10 : null));
  return { rows, marginPct };
}

/** Scenario: how revenue changes with price and volume deltas (percent). */
export function priceScenario(input: { baseRevenue: number; priceChangePct: number; volumeChangePct: number }) {
  const r = input.baseRevenue * (1 + input.priceChangePct / 100) * (1 + input.volumeChangePct / 100);
  return Math.round(r);
}
