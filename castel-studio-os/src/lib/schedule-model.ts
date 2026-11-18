import type { DayModel } from "@/components/bookings/week-editor";
import { windowsToRange } from "@/domain/booking";

/** Stored availability rules → the weekly editor model (open/close, breaks, premium windows per day). */
export function weekModel(rules: { weekday: number; startTime: string; endTime: string; kind: string }[]): DayModel[] {
  return [0, 1, 2, 3, 4, 5, 6].map((w) => {
    const reg = rules.filter((r) => r.weekday === w && r.kind !== "premium").map((r) => ({ start: r.startTime, end: r.endTime }));
    const prem = rules.filter((r) => r.weekday === w && r.kind === "premium").map((r) => ({ start: r.startTime, end: r.endTime })).sort((x, y) => x.start.localeCompare(y.start));
    const range = windowsToRange(reg);
    return range ? { weekday: w, open: true, start: range.open, end: range.close, breaks: range.breaks, premium: prem } : { weekday: w, open: false, start: "09:00", end: "20:00", breaks: [], premium: prem };
  });
}
