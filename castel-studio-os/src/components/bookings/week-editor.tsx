"use client";
import { useMemo, useState } from "react";
import { Plus, Star, Trash2, Coffee } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export type DayModel = { weekday: number; open: boolean; start: string; end: string; breaks: { start: string; end: string }[]; premium: { start: string; end: string }[] };
const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Weekly working hours: open/close, any number of breaks and premium (surcharge) windows per day. */
export function WeekEditor({ initial, he, action, staffId, allowShop }: { initial: DayModel[]; he: boolean; action: (s: ActionState, fd: FormData) => Promise<ActionState>; staffId?: string; allowShop?: boolean }) {
  const L = (h: string, e: string) => (he ? h : e);
  const [days, setDays] = useState<DayModel[]>(initial);
  const json = useMemo(() => JSON.stringify(days), [days]);
  const set = (w: number, patch: Partial<DayModel>) => setDays((d) => d.map((x) => (x.weekday === w ? { ...x, ...patch } : x)));
  const copyToAll = (w: number) => { const src = days.find((x) => x.weekday === w)!; setDays((d) => d.map((x) => (x.weekday === w || !x.open ? x : { ...x, start: src.start, end: src.end, breaks: src.breaks.map((b) => ({ ...b })), premium: src.premium.map((b) => ({ ...b })) }))); };
  const t = (v: string, on: (v: string) => void, label: string) => <Input type="time" value={v} onChange={(e) => on(e.target.value)} dir="ltr" step={300} aria-label={label} className="h-10 min-w-0 px-1.5 text-[15px]" />;
  const list = (w: number, field: "breaks" | "premium") => {
    const d = days.find((x) => x.weekday === w)!;
    return d[field].map((b, i) => (
      <div key={i} className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1 ${field === "premium" ? "bg-gold/10" : "bg-surface-3/60"}`}>
        {field === "premium" ? <Star size={14} className="text-gold" /> : <Coffee size={14} className="text-muted" />}
        {t(b.start, (v) => set(w, { [field]: d[field].map((x, j) => (j === i ? { ...x, start: v } : x)) }), "from")}
        {t(b.end, (v) => set(w, { [field]: d[field].map((x, j) => (j === i ? { ...x, end: v } : x)) }), "to")}
        <button type="button" className="p-1 text-muted hover:text-danger" aria-label={L("הסרה", "Remove")} onClick={() => set(w, { [field]: d[field].filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
      </div>
    ));
  };
  return (
    <ActionForm action={action} className="space-y-2">
      <input type="hidden" name="schedule" value={json} />
      {staffId && <input type="hidden" name="staffId" value={staffId} />}
      {allowShop && <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="useShop" className="h-4 w-4 accent-[var(--gold)]" /> {L("לחזור לשעות המספרה (מחיקת שעות אישיות)", "Use shop hours (remove personal hours)")}</label>}
      {days.map((d) => (
        <div key={d.weekday} className={`rounded-xl border p-2.5 ${d.open ? "border-border bg-surface-2/60" : "border-dashed border-border opacity-70"}`}>
          <div className="grid grid-cols-[76px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={d.open} onChange={(e) => set(d.weekday, { open: e.target.checked })} className="h-5 w-5 accent-[var(--gold)]" />{(he ? DAYS_HE : DAYS_EN)[d.weekday]}</label>
            {d.open ? <>{t(d.start, (v) => set(d.weekday, { start: v }), "open")}{t(d.end, (v) => set(d.weekday, { end: v }), "close")}</> : <span className="col-span-2 text-xs text-muted">{L("סגור", "Closed")}</span>}
          </div>
          {d.open && (
            <div className="mt-2 space-y-1.5">
              {list(d.weekday, "breaks")}
              {list(d.weekday, "premium")}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button type="button" onClick={() => set(d.weekday, { breaks: [...d.breaks, { start: "13:00", end: "14:00" }] })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted hover:text-text"><Plus size={12} /><Coffee size={12} /> {L("הפסקה", "Break")}</button>
                <button type="button" onClick={() => set(d.weekday, { premium: [...d.premium, { start: d.end, end: d.end >= "22:00" ? d.end : `${String(Math.min(23, +d.end.slice(0, 2) + 2)).padStart(2, "0")}:00` }] })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-gold/40 px-2.5 text-xs text-gold"><Plus size={12} /><Star size={12} /> {L("שעות פרימיום", "Premium hours")}</button>
                <button type="button" onClick={() => copyToAll(d.weekday)} className="ms-auto inline-flex h-8 items-center rounded-lg px-2 text-[11px] text-muted underline underline-offset-2">{L("להעתיק לכל הימים הפתוחים", "Copy to all open days")}</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <SubmitButton size="sm">{L("שמירת שעות", "Save hours")}</SubmitButton>
    </ActionForm>
  );
}
