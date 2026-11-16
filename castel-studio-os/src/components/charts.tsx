"use client";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart } from "recharts";

const fmtILS = (locale: string) => (v: number) =>
  new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(v);

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text)" };

export function RevenueChart({ data, locale, labels }: { data: { month: string; income: number; expense: number; net: number }[]; locale: string; labels: { income: string; expense: string; net: string } }) {
  const f = fmtILS(locale);
  const rows = data.map((d) => ({ ...d, label: new Date(d.month + "-01T12:00:00Z").toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", { month: "short", year: "2-digit" }) }));
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...axis} reversed={locale === "he"} />
          <YAxis {...axis} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} width={40} orientation={locale === "he" ? "right" : "left"} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => f(Number(v ?? 0))} cursor={{ fill: "var(--gold-soft)" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
          <Bar dataKey="income" name={labels.income} fill="var(--gold)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name={labels.expense} fill="var(--muted)" fillOpacity={0.45} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line dataKey="net" name={labels.net} stroke="var(--gold-strong)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data, locale }: { data: { label: string; amount: number }[]; locale: string }) {
  // locale "raw" → plain counts (no currency)
  const f = locale === "raw" ? (v: number) => String(v) : fmtILS(locale);
  return (
    <div className="w-full" style={{ height: Math.max(120, data.length * 34) }} dir="ltr">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" {...axis} width={110} orientation={locale === "en" ? "left" : "right"} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => f(Number(v ?? 0))} cursor={{ fill: "var(--gold-soft)" }} />
          <Bar dataKey="amount" fill="var(--gold)" radius={4} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
