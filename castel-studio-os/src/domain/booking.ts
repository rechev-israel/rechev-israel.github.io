/**
 * Pure slot computation for online booking. All times are epoch milliseconds (UTC); the caller converts the
 * business's wall-clock opening hours to absolute windows (handles Asia/Jerusalem DST).
 */
export type Interval = { start: number; end: number };
export type StaffDay = { id: string; windows: Interval[]; busy: Interval[] };
export type Slot = { start: number; staffIds: string[] };

const MIN = 60_000;
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function computeSlots(input: {
  staff: StaffDay[];
  durationMin: number;
  stepMin: number;
  bufferMin: number;
  now: number;
  minNoticeMin: number;
}): Slot[] {
  const { durationMin, stepMin, bufferMin, now, minNoticeMin } = input;
  const dur = durationMin * MIN;
  const step = Math.max(5, stepMin) * MIN;
  const earliest = now + minNoticeMin * MIN;
  const map = new Map<number, string[]>();
  for (const s of input.staff) {
    // A busy block also occupies the buffer after it; a new booking needs its own buffer before the next block.
    const busy = s.busy.map((b) => ({ start: b.start, end: b.end + bufferMin * MIN }));
    for (const w of s.windows) {
      for (let t = w.start; t + dur <= w.end; t += step) {
        if (t < earliest) continue;
        const candidate = { start: t, end: t + dur + bufferMin * MIN };
        const fitsWindow = t + dur <= w.end;
        if (!fitsWindow || busy.some((b) => overlaps(candidate, b) || overlaps({ start: t, end: t + dur }, b))) continue;
        const list = map.get(t) ?? [];
        list.push(s.id);
        map.set(t, list);
      }
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([start, staffIds]) => ({ start, staffIds }));
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
