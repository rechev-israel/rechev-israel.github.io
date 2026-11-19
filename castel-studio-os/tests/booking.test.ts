import { describe, expect, it } from "vitest";
import { canCustomerCancel, computeSlots, editBreak, hhmm, icsEvent, pickStaff, rangeMinusBreaks, windowsToRange } from "@/domain/booking";
import { zonedDate } from "@/lib/dates";

const H = 3_600_000, M = 60_000;
const base = Date.UTC(2027, 0, 4, 7, 0); // 09:00 Jerusalem (UTC+2)

describe("slot computation", () => {
  const staff = [{ id: "a", windows: [{ start: base, end: base + 3 * H }], busy: [] as { start: number; end: number }[] }];
  it("fills the opening window with service-length slots", () => {
    const s = computeSlots({ staff, durationMin: 30, stepMin: 30, bufferMin: 0, now: 0, minNoticeMin: 0 });
    expect(s).toHaveLength(6);
    expect(s[5].start + 30 * M).toBe(base + 3 * H); // last slot ends exactly at closing
  });
  it("never offers a slot overlapping an existing booking (incl. buffer)", () => {
    const busy = [{ start: base + H, end: base + H + 30 * M }];
    const s = computeSlots({ staff: [{ ...staff[0], busy }], durationMin: 30, stepMin: 15, bufferMin: 10, now: 0, minNoticeMin: 0 });
    for (const x of s) {
      expect(x.start + 40 * M <= busy[0].start || x.start >= busy[0].end + 10 * M).toBe(true);
    }
  });
  it("respects minimum notice", () => {
    const s = computeSlots({ staff, durationMin: 30, stepMin: 30, bufferMin: 0, now: base, minNoticeMin: 90 });
    expect(s[0].start).toBe(base + 90 * M);
  });
  it("merges barbers into one list for 'any barber' and picks the least loaded", () => {
    const s = computeSlots({ staff: [staff[0], { id: "b", windows: [{ start: base, end: base + H }], busy: [] }], durationMin: 60, stepMin: 60, bufferMin: 0, now: 0, minNoticeMin: 0 });
    expect(s[0].staffIds.sort()).toEqual(["a", "b"]);
    expect(pickStaff(["a", "b"], { a: 3, b: 1 })).toBe("b");
  });
  it("long services do not fit short windows", () => {
    expect(computeSlots({ staff, durationMin: 240, stepMin: 15, bufferMin: 0, now: 0, minNoticeMin: 0 })).toHaveLength(0);
  });
  it("parses HH:MM strictly", () => {
    expect(hhmm("09:30")).toBe(570);
    expect(hhmm("24:00")).toBeNull();
    expect(hhmm("9:30")).toBeNull();
  });
  it("cancellation window", () => {
    expect(canCustomerCancel(base + 4 * H, base, 180)).toBe(true);
    expect(canCustomerCancel(base + 2 * H, base, 180)).toBe(false);
  });
  it("wall-clock hours survive the DST change (Israel, March 2027)", () => {
    // 09:00 local before and after the spring-forward is 07:00 vs 06:00 UTC
    expect(zonedDate(2027, 3, 21, 9).getUTCHours()).toBe(7);
    expect(zonedDate(2027, 3, 28, 9).getUTCHours()).toBe(6);
  });
  it("produces a valid calendar file", () => {
    const ics = icsEvent({ uid: "x1", start: new Date(base), end: new Date(base + 30 * M), title: "תספורת, זקן", location: "אשקלון" });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20270104T070000Z");
    expect(ics).toContain("תספורת\\, זקן");
  });
});

describe("breaks and premium hours", () => {
  it("open range minus breaks → windows, and back", () => {
    const ws = rangeMinusBreaks("09:00", "20:00", [{ start: "13:00", end: "14:00" }, { start: "17:00", end: "17:30" }]);
    expect(ws).toEqual([{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }, { start: "17:30", end: "20:00" }]);
    expect(windowsToRange(ws!)).toEqual({ open: "09:00", close: "20:00", breaks: [{ start: "13:00", end: "14:00" }, { start: "17:00", end: "17:30" }] });
    expect(rangeMinusBreaks("20:00", "09:00", [])).toBeNull();
    expect(rangeMinusBreaks("09:00", "12:00", [{ start: "08:00", end: "09:30" }])).toEqual([{ start: "09:30", end: "12:00" }]);
  });
  it("no slot crosses a break; regular services skip premium hours; premium services use only them", () => {
    const H = 3_600_000;
    const staff = [{ id: "a", windows: [{ start: base, end: base + 2 * H }, { start: base + 3 * H, end: base + 4 * H }, { start: base + 4 * H, end: base + 5 * H, premium: true }], busy: [] }];
    const s = computeSlots({ staff, durationMin: 60, stepMin: 30, bufferMin: 0, now: 0, minNoticeMin: 0 });
    // nothing at 1.5–2.5 (break); premium hours (4–5) are reserved for premium appointments
    expect(s.map((x) => (x.start - base) / H)).toEqual([0, 0.5, 1, 3]);
    expect(s.every((x) => !x.premium)).toBe(true);
    const p = computeSlots({ staff, durationMin: 60, stepMin: 30, bufferMin: 0, now: 0, minNoticeMin: 0, premiumOnly: true });
    expect(p.map((x) => (x.start - base) / H)).toEqual([4]);
    expect(p[0].premium).toBe(true);
  });
});

describe("editBreak (calendar break editing)", () => {
  const day = [{ start: "09:00", end: "13:00", kind: "regular" }, { start: "14:00", end: "19:00", kind: "regular" }, { start: "20:00", end: "22:00", kind: "premium" }];
  it("removes a break by joining the two windows, keeps premium", () => {
    expect(editBreak(day, "13:00", "14:00", { mode: "remove" })).toEqual([{ start: "09:00", end: "19:00", kind: "regular" }, { start: "20:00", end: "22:00", kind: "premium" }]);
  });
  it("moves a break inside the same working hours", () => {
    expect(editBreak(day, "13:00", "14:00", { mode: "change", newFrom: "12:30", newTo: "13:15" })).toEqual([
      { start: "09:00", end: "12:30", kind: "regular" }, { start: "13:15", end: "19:00", kind: "regular" }, { start: "20:00", end: "22:00", kind: "premium" }]);
  });
  it("rejects invalid edits and gaps that aren't breaks", () => {
    expect(editBreak(day, "13:00", "14:00", { mode: "change", newFrom: "15:00", newTo: "14:00" })).toBeNull();
    expect(editBreak(day, "13:00", "14:00", { mode: "change", newFrom: "08:00", newTo: "10:00" })).toBeNull(); // before opening
    expect(editBreak(day, "19:00", "20:00", { mode: "remove" })).toBeNull(); // regular → premium is not a break
  });
});
