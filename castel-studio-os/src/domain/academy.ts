import { zonedDate, zonedParts } from "@/lib/dates";

/** Official CASTEL STUDIO ACADEMY course definitions (source of truth for seeding). */
export const COURSE_DEFINITIONS = [
  {
    code: "GROUP",
    format: "GROUP" as const,
    nameHe: "קורס ספרות גברים — קבוצתי",
    nameEn: "Men's Barbering Course — Group",
    descriptionHe: "6 מפגשים, פעמיים בשבוע, שעתיים כל מפגש — 12 שעות הדרכה. עד 5 תלמידים בקבוצה.",
    descriptionEn: "6 lessons, twice a week, 2 hours each — 12 instructional hours. Max 5 students.",
    lessonCount: 6,
    lessonsPerWeek: 2,
    lessonDurations: [120, 120, 120, 120, 120, 120],
    price: 5500,
    maxStudents: 5,
  },
  {
    code: "VIP",
    format: "PRIVATE_VIP" as const,
    nameHe: "קורס VIP פרטי",
    nameEn: "Private VIP Course",
    descriptionHe: "6 מפגשים אישיים, פעמיים בשבוע. מפגשים 1 עד 5 בני שעתיים, מפגש מסכם בן 3 שעות — 13 שעות הדרכה.",
    descriptionEn: "6 one-on-one lessons, twice a week. Lessons 1–5 are 2 hours, final lesson 3 hours — 13 instructional hours.",
    lessonCount: 6,
    lessonsPerWeek: 2,
    lessonDurations: [120, 120, 120, 120, 120, 180],
    price: 6500,
    maxStudents: 1,
  },
];

export function totalInstructionalMinutes(lessonDurations: number[]) {
  return lessonDurations.reduce((a, b) => a + b, 0);
}

export function totalInstructionalHours(lessonDurations: number[]) {
  return totalInstructionalMinutes(lessonDurations) / 60;
}

/**
 * Generate lesson start times. Lessons fall on the given weekdays (0=Sun…6=Sat) at the given
 * Jerusalem wall-clock time, starting on/after `startDate`. Default Sunday + Wednesday.
 */
export function generateLessonSchedule(opts: {
  startDate: Date;
  lessonDurations: number[];
  weekdays: number[];
  time: string; // "HH:mm"
}) {
  const weekdays = [...new Set(opts.weekdays)].sort();
  if (weekdays.length === 0) throw new Error("At least one weekday is required");
  if (weekdays.some((d) => d < 0 || d > 6 || !Number.isInteger(d))) throw new Error("Invalid weekday");
  const [hh, mm] = opts.time.split(":").map(Number);
  if (!(hh >= 0 && hh < 24 && mm >= 0 && mm < 60)) throw new Error("Invalid time");

  const start = zonedParts(opts.startDate);
  const lessons: { number: number; startsAt: Date; durationMin: number }[] = [];
  for (let offset = 0; lessons.length < opts.lessonDurations.length && offset < 366; offset++) {
    const day = zonedDate(start.year, start.month, start.day + offset, 12, 0);
    const wd = zonedParts(day).weekday;
    if (!weekdays.includes(wd)) continue;
    const p = zonedParts(day);
    lessons.push({
      number: lessons.length + 1,
      startsAt: zonedDate(p.year, p.month, p.day, hh, mm),
      durationMin: opts.lessonDurations[lessons.length],
    });
  }
  return lessons;
}

export function enrollmentBalance(agreedPrice: number, payments: { amount: number }[]) {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { paid, balance: Math.max(0, Math.round((agreedPrice - paid) * 100) / 100), overpaid: paid > agreedPrice };
}

export function attendanceRate(records: { status: string }[], totalLessonsHeld: number) {
  if (totalLessonsHeld === 0) return null;
  const attended = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  return Math.round((attended / totalLessonsHeld) * 100);
}

/** Certificate eligibility: fully paid, attended ≥ 5 of 6 lessons (excused counts as neither). */
export function certificateEligibility(input: {
  balance: number;
  attendedLessons: number;
  lessonCount: number;
}) {
  const reasons: string[] = [];
  if (input.balance > 0) reasons.push("unpaid");
  if (input.attendedLessons < input.lessonCount - 1) reasons.push("attendance");
  return { eligible: reasons.length === 0, reasons };
}

export function certificateNumber(year: number, seq: number) {
  return `CSA-${year}-${String(seq).padStart(4, "0")}`;
}
