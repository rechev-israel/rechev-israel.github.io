// Date helpers that reason in the business timezone (Asia/Jerusalem).
const TZ = "Asia/Jerusalem";

function tzOffsetMinutes(date: Date, timeZone = TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Build a Date for a wall-clock time in Asia/Jerusalem. */
export function zonedDate(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMinutes(guess);
  const result = new Date(guess.getTime() - off * 60000);
  // correct across DST boundaries
  const off2 = tzOffsetMinutes(result);
  return off2 === off ? result : new Date(guess.getTime() - off2 * 60000);
}

export function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { year: +get("year"), month: +get("month"), day: +get("day"), hour: +get("hour"), minute: +get("minute"), weekday: wd };
}

export function startOfDay(date = new Date()) {
  const p = zonedParts(date);
  return zonedDate(p.year, p.month, p.day);
}

export function addDays(date: Date, n: number) {
  const p = zonedParts(date);
  return zonedDate(p.year, p.month, p.day + n, p.hour, p.minute);
}

export function startOfMonth(date = new Date()) {
  const p = zonedParts(date);
  return zonedDate(p.year, p.month, 1);
}

export function addMonths(date: Date, n: number) {
  const p = zonedParts(date);
  return zonedDate(p.year, p.month + n, 1);
}

/** Parse "YYYY-MM-DDTHH:mm" (from <input type=datetime-local>) as Jerusalem wall time. */
export function parseLocalDateTime(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v);
  if (!m) throw new Error("Invalid date");
  return zonedDate(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

/** Format a Date as "YYYY-MM-DDTHH:mm" in Jerusalem time for datetime-local inputs. */
export function toLocalInput(date: Date | null | undefined, withTime = true): string {
  if (!date) return "";
  const p = zonedParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return withTime ? `${d}T${pad(p.hour)}:${pad(p.minute)}` : d;
}

export function monthKey(date: Date) {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}
