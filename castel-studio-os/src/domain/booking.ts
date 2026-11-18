/**
 * Pure slot computation for online booking. All times are epoch milliseconds (UTC); the caller converts the
 * business's wall-clock opening hours to absolute windows (handles Asia/Jerusalem DST).
 */
export type Interval = { start: number; end: number };
/** An opening window; premium = extra hours with a surcharge. */
export type Window = Interval & { premium?: boolean };
export type StaffDay = { id: string; windows: Window[]; busy: Interval[] };
/** premium = every barber offering this time is in premium hours; regularStaffIds = barbers offering it at the regular price. */
export type Slot = { start: number; staffIds: string[]; premium: boolean; regularStaffIds: string[] };

const MIN = 60_000;
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function computeSlots(input: {
  staff: StaffDay[];
  durationMin: number;
  stepMin: number;
  bufferMin: number;
  now: number;
  minNoticeMin: number;
  /** Service bookable only in premium hours. */
  premiumOnly?: boolean;
}): Slot[] {
  const { durationMin, stepMin, bufferMin, now, minNoticeMin } = input;
  const dur = durationMin * MIN;
  const step = Math.max(5, stepMin) * MIN;
  const earliest = now + minNoticeMin * MIN;
  const map = new Map<number, { ids: string[]; regular: string[] }>();
  for (const s of input.staff) {
    // A busy block also occupies the buffer after it; a new booking needs its own buffer before the next block.
    const busy = s.busy.map((b) => ({ start: b.start, end: b.end + bufferMin * MIN }));
    for (const w of s.windows) {
      // Premium hours are reserved for premium appointments; regular services use regular hours only.
      if (Boolean(input.premiumOnly) !== Boolean(w.premium)) continue;
      for (let t = w.start; t + dur <= w.end; t += step) {
        if (t < earliest) continue;
        const candidate = { start: t, end: t + dur + bufferMin * MIN };
        const fitsWindow = t + dur <= w.end;
        if (!fitsWindow || busy.some((b) => overlaps(candidate, b) || overlaps({ start: t, end: t + dur }, b))) continue;
        const e = map.get(t) ?? { ids: [], regular: [] };
        if (!e.ids.includes(s.id)) e.ids.push(s.id);
        if (!w.premium && !e.regular.includes(s.id)) e.regular.push(s.id);
        map.set(t, e);
      }
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([start, e]) => ({ start, staffIds: e.ids, regularStaffIds: e.regular, premium: e.regular.length === 0 }));
}

/** Parse "HH:MM" → minutes after midnight (null if invalid). */
export function hhmm(v: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Choose who gets an "any barber" booking: the one with the fewest bookings that day, then stable by id. */
export function pickStaff(candidates: string[], loadByStaff: Record<string, number>) {
  return [...candidates].sort((a, b) => (loadByStaff[a] ?? 0) - (loadByStaff[b] ?? 0) || a.localeCompare(b))[0] ?? null;
}

export function canCustomerCancel(startsAt: number, now: number, cancelNoticeMin: number) {
  return startsAt - now >= cancelNoticeMin * MIN;
}

/** Minimal RFC 5545 calendar file for "add to calendar". */
export function icsEvent(e: { uid: string; start: Date; end: Date; title: string; location?: string; description?: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CASTEL STUDIO//Booking//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${e.uid}@castel.studio`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(e.start)}`, `DTEND:${f(e.end)}`,
    `SUMMARY:${esc(e.title)}`, e.location ? `LOCATION:${esc(e.location)}` : "", e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

/** Owner's editor model → stored windows: one open range minus breaks. Returns HH:MM pairs, sorted, non-empty. */
export function rangeMinusBreaks(open: string, close: string, breaks: { start: string; end: string }[]): { start: string; end: string }[] | null {
  const a = hhmm(open), b = hhmm(close);
  if (a == null || b == null || b <= a) return null;
  const bs = breaks.map((x) => [hhmm(x.start), hhmm(x.end)] as const).filter((x): x is readonly [number, number] => x[0] != null && x[1] != null && x[1] > x[0]).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let cur = a;
  for (const [s0, e0] of bs) {
    const s1 = Math.max(s0, a), e1 = Math.min(e0, b);
    if (e1 <= cur || s1 >= b) continue;
    if (s1 > cur) out.push([cur, s1]);
    cur = Math.max(cur, e1);
  }
  if (cur < b) out.push([cur, b]);
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return out.map(([x, y]) => ({ start: f(x), end: f(y) }));
}

/** Stored windows → editor model (open, close, breaks = the gaps). */
export function windowsToRange(ws: { start: string; end: string }[]) {
  const sorted = [...ws].map((w) => ({ s: hhmm(w.start) ?? 0, e: hhmm(w.end) ?? 0, ...w })).sort((x, y) => x.s - y.s);
  if (!sorted.length) return null;
  const breaks = [];
  for (let i = 1; i < sorted.length; i++) if (sorted[i].s > sorted[i - 1].e) breaks.push({ start: sorted[i - 1].end, end: sorted[i].start });
  return { open: sorted[0].start, close: sorted[sorted.length - 1].end, breaks };
}
