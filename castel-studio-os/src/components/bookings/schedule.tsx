"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, CalendarClock, ChevronLeft, ChevronRight, Coffee, CreditCard, Phone, Plus, X } from "lucide-react";
import { ActionForm, InlineAction, SubmitButton } from "@/components/forms";
import { ContactButtons } from "@/components/contact-buttons";
import { Badge, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { editBreakAction } from "@/server/actions/online-booking";
import { setLiveStatusAction } from "@/server/actions/client-features";
import { blockTimeAction, removeBlockAction, rescheduleAppointmentAction, setAppointmentStatusAction, setPaymentStatusAction, updateAppointmentDetailsAction } from "@/server/actions/bookings";

export type CalDay = { key: string; weekday: number; label: string; short: string; open: [number, number] | null; windows?: [number, number, boolean][]; special?: string | null };
export type CalAppt = {
  id: string; dayKey: string; startMin: number; endMin: number; start: string; end: string; status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  customer: { id: string; name: string; phone: string | null } | null; serviceId: string | null; service: string; staffId: string | null; staff: string | null;
  price: number | null; paymentStatus: string; source: string; notes: string | null; startsAtLocal: string; durationMin: number; cancelReason: string | null;
  live?: string; liveDelayMin?: number | null; model?: boolean;
  request?: { style: string | null; fade: string | null; beard: string | null; changes: string | null; note: string | null; photoId: string | null } | null;
};
export type CalBlock = { id: string; dayKey: string; startMin: number; endMin: number; reason: string | null; staff: string | null };

/** Pixels per minute: tall enough that a 20-minute appointment shows name, phone and service. */
const PX_BY_VIEW = { day: 3.6, "3day": 3.4, week: 2.6 } as const;
/** +972501234567 → 050-1234567 */
const localPhone = (p: string | null | undefined) => { if (!p) return ""; const d = p.replace(/\D/g, "").replace(/^972/, "0"); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3)}` : p; };
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const STATUS_STYLE: Record<CalAppt["status"], string> = {
  CONFIRMED: "border-gold/45 border-s-gold bg-[linear-gradient(180deg,color-mix(in_oklab,var(--gold)_22%,var(--surface)),color-mix(in_oklab,var(--gold)_12%,var(--surface)))] text-text",
  SCHEDULED: "border-info/40 border-s-info bg-[color-mix(in_oklab,var(--info)_14%,var(--surface))] text-text",
  COMPLETED: "border-success/35 border-s-success bg-[color-mix(in_oklab,var(--success)_11%,var(--surface))] text-text/90",
  NO_SHOW: "border-danger/40 border-s-danger bg-[color-mix(in_oklab,var(--danger)_11%,var(--surface))] text-text/80",
  CANCELLED: "border-border border-s-border bg-surface-2/70 text-muted line-through",
};
const TIME_TONE: Record<CalAppt["status"], string> = { CONFIRMED: "text-gold-strong", SCHEDULED: "text-info", COMPLETED: "text-success", NO_SHOW: "text-danger", CANCELLED: "text-muted" };
const TONE = { COMPLETED: "success", CANCELLED: "neutral", NO_SHOW: "danger", SCHEDULED: "info", CONFIRMED: "gold" } as const;

/** Side-by-side lanes for overlapping appointments in one day column. */
function lanes<T extends { startMin: number; endMin: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: { item: T; lane: number; lanesInGroup: number }[] = [];
  let group: { item: T; lane: number }[] = [], groupEnd = -1;
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => out.push({ ...g, lanesInGroup: n })); group = []; };
  for (const it of sorted) {
    if (it.startMin >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => g.item.endMin > it.startMin).map((g) => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ item: it, lane }); groupEnd = Math.max(groupEnd, it.endMin);
  }
  if (group.length) flush();
  return out;
}

function nowInJerusalem() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { key: `${g("year")}-${g("month")}-${g("day")}`, min: +g("hour") * 60 + +g("minute") };
}

export function ScheduleCalendar(props: {
  view: "day" | "3day" | "week"; explicitView: boolean; date: string; prev: string; next: string; title: string; locale: string; edit: boolean;
  days: CalDay[]; appts: CalAppt[]; blocks: CalBlock[]; range: [number, number];
  services: { id: string; name: string; durationMin: number; price: number }[]; staff: { id: string; name: string }[];
}) {
  const { view, days, appts, blocks, range, edit, locale } = props;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const router = useRouter();
  const sp = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(nowInJerusalem);
  const [showCancelled, setShowCancelled] = useState(false);
  const [pick, setPick] = useState<{ dayKey: string; min: number } | null>(null);
  const [blockAt, setBlockAt] = useState<{ dayKey: string; min: number } | null>(null);
  const [breakAt, setBreakAt] = useState<{ dayKey: string; from: number; to: number; dayLabel: string; weekday: number } | null>(null);
  const selectedId = sp.get("appt");
  const selected = appts.find((a) => a.id === selectedId) ?? null;
  const PX = PX_BY_VIEW[view];
  const height = (range[1] - range[0]) * PX;

  const go = (params: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) v === null ? q.delete(k) : q.set(k, v);
    router.push(`/bookings?${q.toString()}`, { scroll: false });
  };

  // Phones open on the day view unless a view was chosen explicitly.
  useEffect(() => { if (!props.explicitView && window.innerWidth < 768 && view !== "day") go({ view: "day" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { const t = setInterval(() => setNow(nowInJerusalem()), 60_000); return () => clearInterval(t); }, []);
  // Scroll to "now" (or the selected appointment / opening time) on load.
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const target = selected ? selected.startMin : days.some((d) => d.key === now.key) ? now.min : days.find((d) => d.open)?.open?.[0] ?? range[0];
    el.scrollTop = Math.max(0, (target - range[0]) * PX - 120);
  }, [props.date, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const hours = useMemo(() => { const out: number[] = []; for (let m = Math.ceil(range[0] / 60) * 60; m < range[1]; m += 60) out.push(m); return out; }, [range]);
  const colMin = view === "week" ? "min-w-[118px]" : view === "3day" ? "min-w-[104px]" : "min-w-0";

  const onGridClick = (e: React.MouseEvent<HTMLDivElement>, dayKey: string) => {
    if (!edit || (e.target as HTMLElement).closest("[data-appt],[data-block],[data-break]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor((range[0] + (e.clientY - rect.top) / PX) / 15) * 15;
    setPick({ dayKey, min });
  };

  return (
    <div className="lux-card overflow-hidden rounded-2xl border border-border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => go({ date: props.prev, appt: null })} className={buttonClass("secondary", "sm")} aria-label={L("הקודם", "Previous")}><ChevronRight size={16} className="ltr:rotate-180" /></button>
          <button type="button" onClick={() => go({ date: null, appt: null })} className={buttonClass("ghost", "sm")}>{L("היום", "Today")}</button>
          <button type="button" onClick={() => go({ date: props.next, appt: null })} className={buttonClass("secondary", "sm")} aria-label={L("הבא", "Next")}><ChevronLeft size={16} className="ltr:rotate-180" /></button>
          <p className="ms-2 font-display text-[17px] font-bold sm:text-xl">{props.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
            {(["day", "3day", "week"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => go({ view: v })} className={`h-9 rounded-lg px-3.5 text-sm transition-colors ${view === v ? "btn-gold text-black font-semibold shadow" : "text-muted hover:text-text"}`}>
                {v === "day" ? L("יום", "Day") : v === "3day" ? L("3 ימים", "3 days") : L("שבוע", "Week")}
              </button>
            ))}
          </div>
          {edit && <Link href={`/bookings/new?startsAt=${props.date}T${hm(Math.max(range[0], now.min - (now.min % 15) + 15))}`} className={buttonClass("primary", "sm")}><Plus size={14} /> <span className="hidden sm:inline">{L("תור חדש", "New")}</span></Link>}
        </div>
      </div>

      {/* Summary of the visible period */}
      {(() => {
        const live = appts.filter((x) => x.status !== "CANCELLED");
        const todays = live.filter((x) => x.dayKey === now.key);
        const next = todays.filter((x) => x.endMin > now.min && x.status !== "COMPLETED").sort((x, y) => x.startMin - y.startMin)[0];
        const revenue = live.reduce((sum, x) => sum + (x.price ?? 0), 0);
        const chip = "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs";
        return (
          <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2.5">
            <span className={chip}><b className="font-display text-sm text-gold">{live.length}</b> {L("תורים בתצוגה", "in view")}</span>
            {days.some((d) => d.key === now.key) && <span className={chip}><b className="font-display text-sm text-gold">{todays.length}</b> {L("היום", "today")}</span>}
            <span className={chip}>{L("הכנסה צפויה", "Expected")} <b className="font-display text-sm text-gold" dir="ltr">₪{revenue.toLocaleString("he-IL")}</b></span>
            {next && <button type="button" onClick={() => go({ appt: next.id })} className={`${chip} border-gold/40 hover:border-gold`}>{L("הבא בתור", "Next up")}: <b dir="ltr">{next.start}</b> · {next.customer?.name ?? ""}</button>}
          </div>
        );
      })()}

      {/* Grid */}
      <div ref={scroller} className="relative max-h-[72dvh] overflow-auto overscroll-contain">
        <div className="flex min-w-full" style={{ width: view === "day" ? "100%" : undefined }}>
          {/* Time axis */}
          <div className="sticky start-0 z-20 w-12 shrink-0 border-e border-border bg-surface sm:w-14">
            <div className="sticky top-0 z-10 h-14 border-b border-border bg-surface" />
            <div className="relative" style={{ height }}>
              {hours.map((m) => <span key={m} className="absolute end-1.5 -translate-y-1/2 text-[11px] tabular-nums text-muted" style={{ top: (m - range[0]) * PX }} dir="ltr">{hm(m)}</span>)}
            </div>
          </div>
          {days.map((d) => {
            const isToday = d.key === now.key;
            const dayAppts = appts.filter((a) => a.dayKey === d.key && (showCancelled || a.status !== "CANCELLED"));
            const dayBlocks = blocks.filter((b) => b.dayKey === d.key);
            return (
              <div key={d.key} className={`relative flex-1 border-e border-border last:border-e-0 ${colMin}`}>
                <button type="button" onClick={() => go({ view: "day", date: d.key, appt: null })} className={`sticky top-0 z-10 flex h-14 w-full items-center justify-center gap-2 border-b border-border bg-surface/95 backdrop-blur ${isToday ? "text-gold" : ""} ${!d.open ? "text-muted/70" : ""}`}>
                  <span className="text-[11px] font-semibold tracking-wide">{d.short}</span>
                  <span className={`grid h-8 min-w-8 place-items-center rounded-full px-1 font-display text-base font-bold tabular-nums ${isToday ? "btn-gold text-black" : ""}`}>{+d.label.slice(0, 2)}</span>
                  {d.special && <span className="text-[10px] text-gold" title={d.special}>★</span>}
                </button>
                <div className="relative cursor-copy bg-[#070707]" style={{ height, backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${30 * PX}px, color-mix(in oklab, var(--border) 45%, transparent) ${30 * PX}px ${30 * PX + 1}px, transparent ${30 * PX + 1}px ${60 * PX}px)`, backgroundPositionY: `${((Math.ceil(range[0] / 60) * 60 - range[0]) * PX)}px` }} onClick={(e) => onGridClick(e, d.key)}>
                  {/* closed hours */}
                  {!d.open ? <div className="absolute inset-0 bg-[#2c2b29] bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgba(255,255,255,0.035)_8px_16px)]" /> : (() => {
                    // Shade everything outside working windows (before opening, breaks, after closing); tint premium hours.
                    const ws = [...(d.windows ?? [[d.open[0], d.open[1], false]] as [number, number, boolean][])].sort((x, y) => x[0] - y[0]);
                    const gaps: [number, number][] = []; let cur = range[0];
                    for (const [s0, e0] of ws) { if (s0 > cur) gaps.push([cur, s0]); cur = Math.max(cur, e0); }
                    if (cur < range[1]) gaps.push([cur, range[1]]);
                    // A break = a gap between two regular working windows (not before opening / after closing, not premium).
                    const reg = ws.filter((w) => !w[2]);
                    const breaks: [number, number][] = [];
                    for (let i = 0; i + 1 < reg.length; i++) if (reg[i][1] < reg[i + 1][0] && !ws.some((w) => w[2] && w[0] < reg[i + 1][0] && w[1] > reg[i][1])) breaks.push([reg[i][1], reg[i + 1][0]]);
                    return (<>
                      {gaps.map(([a, b], k) => <div key={`g${k}`} className="absolute inset-x-0 bg-[#2c2b29]" style={{ top: (a - range[0]) * PX, height: (b - a) * PX }} />)}
                      {breaks.map(([a, b]) => (
                        <button key={`b${a}`} type="button" data-break disabled={!edit} onClick={(e) => { e.stopPropagation(); setBreakAt({ dayKey: d.key, from: a, to: b, dayLabel: `${d.short} ${d.label}`, weekday: d.weekday }); }}
                          className="absolute inset-x-0 z-[1] flex items-start justify-center gap-1 overflow-hidden border-y border-dashed border-white/10 pt-0.5 text-[10px] text-muted transition-colors enabled:cursor-pointer enabled:hover:bg-white/[0.04] enabled:hover:text-gold"
                          style={{ top: (a - range[0]) * PX, height: (b - a) * PX }} aria-label={L(`הפסקה ${hm(a)}–${hm(b)}`, `Break ${hm(a)}–${hm(b)}`)}>
                          {(b - a) * PX >= 16 && <><Coffee size={10} className="mt-px shrink-0" /><span className="truncate">{L("הפסקה", "Break")} <span dir="ltr" className="tabular-nums">{hm(a)}–{hm(b)}</span></span></>}
                        </button>
                      ))}
                      {ws.filter((w) => w[2]).map(([a, b], k) => <div key={`p${k}`} className="pointer-events-none absolute inset-x-0 border-y border-gold/25 bg-gold/[0.07]" style={{ top: (a - range[0]) * PX, height: (b - a) * PX }}><span className="absolute end-1 top-0.5 text-[10px] text-gold">⭐</span></div>)}
                    </>);
                  })()}
                  {dayBlocks.map((b) => (
                    <div key={b.id} data-block className="absolute inset-x-0.5 z-[1] overflow-hidden rounded-md border border-dashed border-border bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.04)_0_6px,transparent_6px_12px)] p-1 text-[10px] text-muted" style={{ top: (b.startMin - range[0]) * PX, height: Math.max(18, (b.endMin - b.startMin) * PX) }}>
                      <div className="flex items-start justify-between gap-1"><span className="truncate"><Ban size={10} className="inline" /> {b.reason || L("חסום", "Blocked")}{b.staff ? ` · ${b.staff}` : ""}</span>
                        {edit && <InlineAction action={removeBlockAction} fields={{ id: b.id }} confirm={L("לבטל את החסימה?", "Remove block?")} className="h-5 px-1 text-[10px]">✕</InlineAction>}</div>
                    </div>
                  ))}
                  {lanes(dayAppts).map(({ item: a, lane, lanesInGroup }) => {
                    const h = Math.max(30, (a.endMin - a.startMin) * PX - 3);
                    const narrow = lanesInGroup > 1 || view !== "day";
                    const phone = localPhone(a.customer?.phone);
                    return (
                      <button key={a.id} type="button" data-appt onClick={() => go({ appt: a.id })}
                        className={`absolute z-[2] flex flex-col overflow-hidden rounded-lg border border-s-[3px] px-2 py-1.5 text-start text-[12px] leading-snug shadow-[0_4px_14px_-8px_rgba(0,0,0,0.7)] transition-transform hover:z-[3] hover:-translate-y-px ${STATUS_STYLE[a.status]} ${a.model ? "!border-gold" : ""} ${selectedId === a.id ? "ring-2 ring-gold ring-offset-1 ring-offset-[var(--surface)]" : ""}`}
                        style={{ top: (a.startMin - range[0]) * PX + 1, height: h, insetInlineStart: `calc(${(lane / lanesInGroup) * 100}% + 2px)`, width: `calc(${100 / lanesInGroup}% - 4px)` }}>
                        {a.model && <span className="mb-0.5 self-start rounded-sm bg-gradient-to-l from-[#b38d5c] via-[#e2c99f] to-[#b38d5c] px-1.5 py-px text-[9px] font-bold tracking-[0.18em] text-black">CASTEL MODEL</span>}
                        {/* Name first and biggest; then time, phone, service — as much as the height allows. */}
                        {narrow ? (<>
                          {/* Narrow column: the name gets its own full line, the time goes under it. */}
                          <span className="truncate text-[13px] font-bold">{a.customer?.name ?? L("ללא לקוח", "Walk-in")}</span>
                          <span className={`truncate text-[11px] font-semibold tabular-nums ${TIME_TONE[a.status]}`} dir="ltr">{a.start}–{a.end}</span>
                        </>) : (
                          <span className="flex min-w-0 items-baseline justify-between gap-2">
                            <span className="truncate text-[15px] font-bold">{a.customer?.name ?? L("ללא לקוח", "Walk-in")}</span>
                            <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${TIME_TONE[a.status]}`} dir="ltr">{a.start}–{a.end}</span>
                          </span>
                        )}
                        {h >= (narrow ? 64 : 52) && <span className="truncate text-[12px] text-text/80">{[phone && <span key="p" dir="ltr">{phone}</span>, a.service].filter(Boolean).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, " · ", x] : [x]), [])}{a.paymentStatus === "PAID" ? " · ₪✓" : ""}</span>}
                        {h >= 84 && a.notes && <span className="truncate text-[11px] text-muted">{a.notes.split("\n")[0]}</span>}
                      </button>
                    );
                  })}
                  {isToday && now.min >= range[0] && now.min <= range[1] && (
                    <div className="pointer-events-none absolute inset-x-0 z-[4] flex items-center" style={{ top: (now.min - range[0]) * PX }}>
                      <span className="-ms-1 h-2.5 w-2.5 rounded-full bg-red-500" /><span className="h-px flex-1 bg-red-500" />
                    </div>
                  )}
                  {pick?.dayKey === d.key && (
                    <div className="absolute inset-x-1 z-[5] rounded-lg border border-gold/60 bg-surface p-2 shadow-xl" style={{ top: Math.min((pick.min - range[0]) * PX, height - 96) }} onClick={(e) => e.stopPropagation()}>
                      <p className="mb-1.5 text-xs font-semibold tabular-nums" dir="ltr">{hm(pick.min)}</p>
                      <div className="flex flex-col gap-1">
                        <Link href={`/bookings/new?startsAt=${d.key}T${hm(pick.min)}`} className={buttonClass("primary", "sm", "w-full")}><Plus size={13} /> {L("תור חדש", "New appointment")}</Link>
                        <button type="button" className={buttonClass("secondary", "sm", "w-full")} onClick={() => { setBlockAt(pick); setPick(null); }}><Ban size={13} /> {L("חסימת זמן", "Block time")}</button>
                        <button type="button" className="text-[11px] text-muted" onClick={() => setPick(null)}>{L("סגירה", "Close")}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border p-3 text-[11px] text-muted">
        {(["CONFIRMED", "SCHEDULED", "COMPLETED", "NO_SHOW"] as const).map((s) => <span key={s} className="inline-flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-sm border ${STATUS_STYLE[s]}`} />{({ CONFIRMED: L("מאושר", "Confirmed"), SCHEDULED: L("ממתין", "Pending"), COMPLETED: L("הושלם", "Completed"), NO_SHOW: L("לא הגיע", "No-show") })[s]}</span>)}
        <label className="ms-auto inline-flex items-center gap-1.5"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="accent-[var(--gold)]" /> {L("הצגת מבוטלים", "Show cancelled")}</label>
        {edit && <span>{L("לחיצה על משבצת ריקה: תור חדש או חסימה", "Tap an empty slot: new appointment or block")}</span>}
      </div>

      {selected && <AppointmentPanel a={selected} he={he} edit={edit} services={props.services} staff={props.staff} onClose={() => go({ appt: null })} />}
      {blockAt && <BlockDialog at={blockAt} he={he} staff={props.staff} onClose={() => setBlockAt(null)} />}
      {breakAt && <BreakDialog at={breakAt} he={he} onClose={() => setBreakAt(null)} />}
    </div>
  );
}

/** Rendered into <body> (portal): an animated/transformed page ancestor would otherwise pin a "fixed" panel to the
 * bottom of the page instead of the screen. Locks background scrolling while open. */
function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] animate-[sheet-fade_.2s_ease-out] sm:items-stretch sm:justify-end" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[86dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-border bg-surface p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-[sheet-up_.28s_cubic-bezier(.2,.7,.1,1)] sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-y-0 sm:border-e-0" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0">{title}</div><button type="button" onClick={onClose} className={buttonClass("ghost", "sm")} aria-label="close"><X size={16} /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function AppointmentPanel({ a, he, edit, services, staff, onClose }: { a: CalAppt; he: boolean; edit: boolean; services: { id: string; name: string; durationMin: number; price: number }[]; staff: { id: string; name: string }[]; onClose: () => void }) {
  const L = (h: string, e: string) => (he ? h : e);
  const statusLabel = { CONFIRMED: L("מאושר", "Confirmed"), SCHEDULED: L("ממתין לאישור", "Pending"), COMPLETED: L("הושלם", "Completed"), NO_SHOW: L("לא הגיע", "No-show"), CANCELLED: L("בוטל", "Cancelled") }[a.status];
  const active = a.status === "SCHEDULED" || a.status === "CONFIRMED";
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-3 border-b border-border py-2 text-sm"><dt className="text-muted">{k}</dt><dd className="text-end">{v}</dd></div>;
  return (
    <Sheet onClose={onClose} title={<>
      <p className="font-display text-xl font-bold">{a.customer ? <Link href={`/crm/${a.customer.id}`} className="hover:text-gold">{a.customer.name}</Link> : L("ללא לקוח", "Walk-in")}</p>
      <div className="mt-1 flex flex-wrap gap-1.5"><Badge tone={TONE[a.status]}>{statusLabel}</Badge><Badge tone={a.paymentStatus === "PAID" ? "success" : "neutral"}>{a.paymentStatus === "PAID" ? L("שולם", "Paid") : L("לא שולם", "Unpaid")}</Badge>{a.source === "online" && <Badge tone="info">{L("נקבע באתר", "Booked online")}</Badge>}</div>
    </>}>
      <dl className="mb-4">
        {row(L("מועד", "When"), <span dir="ltr" className="tabular-nums">{a.startsAtLocal.slice(8, 10)}.{a.startsAtLocal.slice(5, 7)} · {a.start}–{a.end}</span>)}
        {row(L("משך", "Duration"), `${a.durationMin} ${L("דק׳", "min")}`)}
        {row(L("שירות", "Service"), a.service || "—")}
        {row(L("מחיר", "Price"), a.price != null ? `₪${a.price}` : "—")}
        {a.staff && row(L("ספר", "Barber"), a.staff)}
        {a.customer?.phone && row(L("טלפון", "Phone"), <span className="inline-flex flex-wrap items-center justify-end gap-2"><a href={`tel:${a.customer.phone}`} className="inline-flex items-center gap-1 text-gold" dir="ltr"><Phone size={12} /> {a.customer.phone}</a><ContactButtons phone={a.customer.phone} he={he} compact /></span>)}
        {a.notes && row(L("הערות", "Notes"), <span className="whitespace-pre-wrap">{a.notes}</span>)}
        {a.cancelReason && row(L("סיבת ביטול", "Cancel reason"), a.cancelReason === "customer_online" ? L("בוטל ע״י הלקוח באתר", "Cancelled by customer online") : a.cancelReason)}
      </dl>
      {a.request && (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/[0.06] p-3 text-sm">
          <p className="mb-1.5 font-medium text-gold">✂ {L("בקשה מיוחדת מהלקוח", "Customer's special request")}</p>
          <div className="flex gap-3">
            {a.request.photoId && <img src={`/api/admin/photos/${a.request.photoId}`} alt={L("תמונת השראה", "Inspiration photo")} className="h-24 w-20 shrink-0 rounded-lg border border-border object-cover" />}
            <dl className="min-w-0 space-y-0.5">
              {([[L("סגנון", "Style"), a.request.style], [L("פייד", "Fade"), a.request.fade], [L("זקן", "Beard"), a.request.beard], [L("שינויים", "Changes"), a.request.changes], [L("הערה", "Note"), a.request.note]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline whitespace-pre-wrap">{v}</dd></div>)}
            </dl>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{L("הבקשה לא משנה את משך התור או את המחיר.", "Doesn't change duration or price.")}</p>
        </div>
      )}
      {edit && (a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
        <div className="mb-4 rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-medium">{L("סטטוס חי ללקוח", "Live status for the customer")} {a.live === "delay" ? <Badge tone="warning">{L(`עיכוב ${a.liveDelayMin ?? ""} דק׳`, `Delay ${a.liveDelayMin ?? ""} min`)}</Badge> : a.live === "ready" ? <Badge tone="success">{L("אפשר להיכנס", "Come in")}</Badge> : null}</p>
          <div className="flex flex-wrap gap-2">
            {[10, 15, 30].map((m) => <InlineAction key={m} action={setLiveStatusAction} fields={{ id: a.id, status: "delay", delay: String(m) }} variant="secondary">{L(`עיכוב ${m} דק׳`, `${m} min delay`)}</InlineAction>)}
            <InlineAction action={setLiveStatusAction} fields={{ id: a.id, status: "ready" }} variant="primary">{L("אפשר להיכנס", "Come in now")}</InlineAction>
            {(a.live === "delay" || a.live === "ready") && <InlineAction action={setLiveStatusAction} fields={{ id: a.id, status: "clear" }}>{L("ניקוי", "Clear")}</InlineAction>}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{L("הלקוח רואה את זה ב־MY CASTEL ובמסך התור שלו. שום דבר לא נשלח לבד.", "Shown in the customer's MY CASTEL and booking page. Nothing is sent automatically.")}</p>
        </div>
      )}
      {edit && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {a.status === "SCHEDULED" && <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "CONFIRMED" }} variant="primary" size="md">{L("אישור התור", "Confirm")}</InlineAction>}
            {active && <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "COMPLETED" }} variant="secondary" size="md" className="text-success">{L("הושלם", "Completed")}</InlineAction>}
            {active && <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "NO_SHOW" }} variant="secondary" size="md" className="text-danger">{L("לא הגיע", "No-show")}</InlineAction>}
            {a.status === "COMPLETED" && <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "NO_SHOW" }} variant="secondary" size="md" className="text-danger">{L("בעצם לא הגיע", "Actually a no-show")}</InlineAction>}
            {!active && <InlineAction action={setAppointmentStatusAction} fields={{ id: a.id, status: "SCHEDULED" }} variant="secondary" size="md">↺ {L("החזרה לפעיל", "Reactivate")}</InlineAction>}
            <InlineAction action={setPaymentStatusAction} fields={{ id: a.id, paymentStatus: a.paymentStatus === "PAID" ? "UNPAID" : "PAID" }} variant="secondary" size="md"><CreditCard size={14} /> {a.paymentStatus === "PAID" ? L("סימון כלא שולם", "Mark unpaid") : L("סימון כשולם", "Mark paid")}</InlineAction>
          </div>
          {active && (
            <details className="rounded-xl border border-border p-3" open={false}>
              <summary className="cursor-pointer text-sm font-semibold text-gold"><CalendarClock size={14} className="inline" /> {L("הזזת התור", "Reschedule")}</summary>
              <ActionForm action={rescheduleAppointmentAction} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={a.id} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2"><Label>{L("מועד חדש", "New time")}</Label><Input type="datetime-local" name="startsAt" defaultValue={a.startsAtLocal} step={300} dir="ltr" required /></div>
                  <div><Label>{L("משך (דק׳)", "Duration")}</Label><Input type="number" name="durationMin" min={5} max={600} defaultValue={a.durationMin} /></div>
                  {staff.length > 1 && <div><Label>{L("ספר", "Barber")}</Label><Select name="staffId" defaultValue={a.staffId ?? ""}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="allowOverlap" className="accent-[var(--gold)]" /> {L("לאפשר חפיפה עם תור אחר", "Allow overlap")}</label>
                <SubmitButton size="sm">{L("שמירת המועד", "Save")}</SubmitButton>
              </ActionForm>
            </details>
          )}
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gold">{L("עריכת פרטים", "Edit details")}</summary>
            <ActionForm action={updateAppointmentDetailsAction} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={a.id} />
              <div><Label>{L("שירות", "Service")}</Label><Select name="serviceId" defaultValue={a.serviceId ?? ""}><option value="">—</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMin}′ · ₪{s.price}</option>)}</Select></div>
              <div><Label>{L("מחיר (₪)", "Price (₪)")}</Label><Input type="number" name="price" min={0} step="1" defaultValue={a.price ?? ""} /></div>
              <div><Label>{L("הערות", "Notes")}</Label><Textarea name="notes" rows={3} defaultValue={a.notes ?? ""} maxLength={1000} /></div>
              <SubmitButton size="sm">{L("שמירה", "Save")}</SubmitButton>
            </ActionForm>
          </details>
          {active && (
            <details className="rounded-xl border border-danger/30 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-danger">{L("ביטול התור", "Cancel appointment")}</summary>
              <form action={setAppointmentStatusAction} className="mt-3 space-y-2" onSubmit={(e) => { if (!window.confirm(L("לבטל את התור?", "Cancel this appointment?"))) e.preventDefault(); }}>
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="CANCELLED" />
                <Input name="reason" maxLength={300} placeholder={L("סיבה (לא חובה)", "Reason (optional)")} />
                <SubmitButton size="sm" variant="danger">{L("ביטול התור", "Cancel appointment")}</SubmitButton>
              </form>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}

function BlockDialog({ at, he, staff, onClose }: { at: { dayKey: string; min: number }; he: boolean; staff: { id: string; name: string }[]; onClose: () => void }) {
  const L = (h: string, e: string) => (he ? h : e);
  return (
    <Sheet onClose={onClose} title={<p className="font-display text-xl font-bold">{L("חסימת זמן ביומן", "Block time")}</p>}>
      <p className="mb-3 text-xs text-muted">{L("בזמן חסום לא ניתן לקבוע תורים באתר.", "Customers can't book during blocked time.")}</p>
      <ActionForm action={async (s, fd) => { const r = await blockTimeAction(s, fd); if (r?.ok) onClose(); return r; }} className="space-y-2">
        <div><Label>{L("מ-", "From")}</Label><Input type="datetime-local" name="from" defaultValue={`${at.dayKey}T${hm(at.min)}`} step={300} dir="ltr" required /></div>
        <div><Label>{L("למשך", "For")}</Label><Select name="minutes" defaultValue="60">{[15, 30, 45, 60, 90, 120, 180, 240, 480, 720].map((m) => <option key={m} value={m}>{m < 60 ? `${m} ${L("דק׳", "min")}` : `${m / 60} ${L("שעות", "h")}`}</option>)}</Select></div>
        {staff.length > 1 && <div><Label>{L("למי", "Who")}</Label><Select name="staffId"><option value="">{L("כל המספרה", "Whole shop")}</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>}
        <div><Label>{L("סיבה", "Reason")}</Label><Input name="reason" maxLength={120} placeholder={L("הפסקה / סידור", "Break / errand")} /></div>
        <SubmitButton size="sm">{L("חסימה", "Block")}</SubmitButton>
      </ActionForm>
    </Sheet>
  );
}

const WEEKDAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Tap a break in the calendar: remove it, move it, or keep it — on this date only or every week. */
function BreakDialog({ at, he, onClose }: { at: { dayKey: string; from: number; to: number; dayLabel: string; weekday: number }; he: boolean; onClose: () => void }) {
  const L = (h: string, e: string) => (he ? h : e);
  const [scope, setScope] = useState<"day" | "week">("day");
  const run = async (s: Parameters<typeof editBreakAction>[0], fd: FormData) => { const r = await editBreakAction(s, fd); if (r?.ok) onClose(); return r; };
  const base = { date: at.dayKey, from: hm(at.from), to: hm(at.to), scope };
  const hidden = (extra: Record<string, string>) => Object.entries({ ...base, ...extra }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const wd = he ? `כל יום ${WEEKDAY_HE[at.weekday]}` : `Every ${WEEKDAY_EN[at.weekday]}`;
  return (
    <Sheet onClose={onClose} title={<><p className="font-display text-xl font-bold"><Coffee size={18} className="me-1.5 inline text-gold" />{L("הפסקה", "Break")} <span dir="ltr" className="tabular-nums">{hm(at.from)}–{hm(at.to)}</span></p><p className="text-xs text-muted">{at.dayLabel}</p></>}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border p-1 text-sm" role="radiogroup" aria-label={L("על מה להחיל", "Apply to")}>
        {([["day", L("רק בתאריך הזה", "This date only")], ["week", wd]] as const).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={scope === k} onClick={() => setScope(k)} className={`rounded-lg px-2 py-2 ${scope === k ? "btn-gold text-black" : "text-muted"}`}>{label}</button>
        ))}
      </div>
      <ActionForm action={run} className="mb-4">
        {hidden({ mode: "remove" })}
        <SubmitButton variant="danger" className="w-full">{L("ביטול ההפסקה", "Remove break")}</SubmitButton>
        <p className="mt-1.5 text-xs text-muted">{scope === "day" ? L("ביום הזה אפשר יהיה לקבוע תורים גם בשעות ההפסקה.", "Customers can book during this time on this date.") : L(`ההפסקה תבוטל ${wd}. אפשר להחזיר אותה בשעות פעילות.`, `The break is removed ${wd.toLowerCase()}. You can add it back in Working hours.`)}</p>
      </ActionForm>
      <ActionForm action={run} className="space-y-2 rounded-xl border border-border p-3">
        {hidden({ mode: "change" })}
        <p className="text-sm font-medium">{L("שינוי שעות ההפסקה", "Change break times")}</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{L("מ-", "From")}</Label><Input type="time" name="newFrom" defaultValue={hm(at.from)} step={300} dir="ltr" required /></div>
          <div><Label>{L("עד", "To")}</Label><Input type="time" name="newTo" defaultValue={hm(at.to)} step={300} dir="ltr" required /></div>
        </div>
        <SubmitButton size="sm" className="w-full">{L("שמירת השינוי", "Save change")}</SubmitButton>
      </ActionForm>
      <button type="button" onClick={onClose} className={`${buttonClass("ghost", "sm")} mt-3 w-full`}>{L("להשאיר כמו שזה", "Keep as is")}</button>
      <p className="mt-2 text-[11px] text-muted">{L("תורים שכבר נקבעו לא משתנים.", "Existing appointments are not changed.")}</p>
    </Sheet>
  );
}
