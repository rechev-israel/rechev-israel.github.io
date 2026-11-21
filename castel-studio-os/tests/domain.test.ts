import { describe, expect, it } from "vitest";
import { COURSE_DEFINITIONS, attendanceRate, certificateEligibility, certificateNumber, enrollmentBalance, generateLessonSchedule, totalInstructionalHours } from "@/domain/academy";
import { canMarketTo, computeSegment, normalizeIsraeliPhone, upcomingBirthday } from "@/domain/crm";
import { byCategory, margin, monthlySeries, naiveForecast, priceScenario, summarize } from "@/domain/finance";
import { toLocalInput, zonedDate, zonedParts } from "@/lib/dates";
import { csvCell, toCsv } from "@/lib/utils";

describe("academy course definitions", () => {
  const group = COURSE_DEFINITIONS.find((c) => c.code === "GROUP")!;
  const vip = COURSE_DEFINITIONS.find((c) => c.code === "VIP")!;
  it("group course: 6 lessons × 2h = 12h, 5,500 ILS, max 5", () => {
    expect(group.lessonCount).toBe(6);
    expect(group.lessonsPerWeek).toBe(2);
    expect(totalInstructionalHours(group.lessonDurations)).toBe(12);
    expect(group.price).toBe(5500);
    expect(group.maxStudents).toBe(5);
  });
  it("VIP course: lessons 1–5 2h, final 3h = 13h, 6,500 ILS", () => {
    expect(vip.lessonDurations.slice(0, 5).every((d) => d === 120)).toBe(true);
    expect(vip.lessonDurations[5]).toBe(180);
    expect(totalInstructionalHours(vip.lessonDurations)).toBe(13);
    expect(vip.price).toBe(6500);
  });
});

describe("lesson schedule", () => {
  it("generates 6 lessons on Sun+Wed at 18:00 Jerusalem time", () => {
    const lessons = generateLessonSchedule({ startDate: zonedDate(2027, 1, 3, 12), lessonDurations: [120, 120, 120, 120, 120, 180], weekdays: [0, 3], time: "18:00" });
    expect(lessons).toHaveLength(6);
    expect(lessons.map((l) => zonedParts(l.startsAt).weekday)).toEqual([0, 3, 0, 3, 0, 3]);
    expect(lessons.every((l) => zonedParts(l.startsAt).hour === 18)).toBe(true);
    expect(toLocalInput(lessons[0].startsAt)).toBe("2027-01-03T18:00");
    expect(lessons[5].durationMin).toBe(180);
  });
  it("handles DST (Israel switches late March)", () => {
    const lessons = generateLessonSchedule({ startDate: zonedDate(2027, 3, 21, 12), lessonDurations: [120, 120, 120, 120, 120, 120], weekdays: [1, 4], time: "19:30" });
    expect(lessons.every((l) => toLocalInput(l.startsAt).endsWith("19:30"))).toBe(true);
  });
  it("rejects invalid input", () => {
    expect(() => generateLessonSchedule({ startDate: new Date(), lessonDurations: [60], weekdays: [], time: "18:00" })).toThrow();
    expect(() => generateLessonSchedule({ startDate: new Date(), lessonDurations: [60], weekdays: [1], time: "25:00" })).toThrow();
  });
});

describe("academy money & certificates", () => {
  it("computes balance", () => {
    expect(enrollmentBalance(5500, [{ amount: 2000 }, { amount: 1500 }])).toEqual({ paid: 3500, balance: 2000, overpaid: false });
    expect(enrollmentBalance(5500, [{ amount: 6000 }]).balance).toBe(0);
  });
  it("eligibility requires full payment and ≥5/6 attendance", () => {
    expect(certificateEligibility({ balance: 0, attendedLessons: 5, lessonCount: 6 }).eligible).toBe(true);
    expect(certificateEligibility({ balance: 100, attendedLessons: 6, lessonCount: 6 }).reasons).toEqual(["unpaid"]);
    expect(certificateEligibility({ balance: 0, attendedLessons: 4, lessonCount: 6 }).reasons).toEqual(["attendance"]);
  });
  it("formats certificate numbers and attendance rate", () => {
    expect(certificateNumber(2027, 7)).toBe("CSA-2027-0007");
    expect(attendanceRate([{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }], 4)).toBe(50);
    expect(attendanceRate([], 0)).toBeNull();
  });
});

describe("CRM", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000);
  it("segments customers by recency/value", () => {
    expect(computeSegment({ status: "ACTIVE", lastVisitAt: daysAgo(10), visitCount: 3, totalSpent: 300 }, now)).toBe("ACTIVE");
    expect(computeSegment({ status: "ACTIVE", lastVisitAt: daysAgo(10), visitCount: 20, totalSpent: 300 }, now)).toBe("VIP");
    expect(computeSegment({ status: "VIP", lastVisitAt: daysAgo(60), visitCount: 20, totalSpent: 9000 }, now)).toBe("AT_RISK");
    expect(computeSegment({ status: "ACTIVE", lastVisitAt: daysAgo(120), visitCount: 2, totalSpent: 200 }, now)).toBe("LAPSED");
    expect(computeSegment({ status: "BLOCKED", lastVisitAt: daysAgo(1), visitCount: 50, totalSpent: 9000 }, now)).toBe("BLOCKED");
    expect(computeSegment({ status: "ACTIVE", lastVisitAt: null, visitCount: 0, totalSpent: 0 }, now)).toBe("ACTIVE");
  });
  it("normalises Israeli phones", () => {
    expect(normalizeIsraeliPhone("050-123-4567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("+972 50 123 4567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("00972501234567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("08-6712345")).toBe("+97286712345");
    expect(normalizeIsraeliPhone("123")).toBeNull();
    expect(normalizeIsraeliPhone("")).toBeNull();
  });
  it("finds upcoming birthdays incl. year wrap", () => {
    expect(upcomingBirthday(new Date("1990-11-20T00:00:00Z"), now)).toBe(4);
    expect(upcomingBirthday(new Date("1990-11-10T00:00:00Z"), now)).toBeNull();
    expect(upcomingBirthday(new Date("1990-01-02T00:00:00Z"), new Date("2026-12-25T10:00:00Z"))).toBe(8);
  });
  it("only markets to explicit opt-ins and never to blocked", () => {
    const base = { marketingConsentSms: "UNKNOWN", marketingConsentEmail: "OPTED_OUT", marketingConsentWhatsapp: "OPTED_IN", status: "ACTIVE" };
    expect(canMarketTo(base, "WHATSAPP")).toBe(true);
    expect(canMarketTo(base, "SMS")).toBe(false);
    expect(canMarketTo(base, "EMAIL")).toBe(false);
    expect(canMarketTo({ ...base, status: "BLOCKED" }, "WHATSAPP")).toBe(false);
  });
});

describe("finance", () => {
  const d = (s: string) => new Date(s + "T12:00:00Z");
  const txs = [
    { type: "INCOME" as const, kind: "ACTUAL" as const, amount: 1000, occurredAt: d("2026-10-05"), category: "services" },
    { type: "INCOME" as const, kind: "ACTUAL" as const, amount: 5500, occurredAt: d("2026-10-07"), category: "academy" },
    { type: "EXPENSE" as const, kind: "ACTUAL" as const, amount: 2000, occurredAt: d("2026-10-01"), category: "rent" },
    { type: "INCOME" as const, kind: "ESTIMATE" as const, amount: 9999, occurredAt: d("2026-10-20"), category: "services" },
    { type: "INCOME" as const, kind: "ACTUAL" as const, amount: 800, occurredAt: d("2026-11-03"), category: "services" },
  ];
  it("keeps actuals and estimates separate", () => {
    const s = summarize(txs);
    expect(s.actual).toEqual({ income: 7300, expense: 2000, net: 5300 });
    expect(s.estimate.income).toBe(9999);
  });
  it("builds monthly actual series excluding estimates", () => {
    const series = monthlySeries(txs, ["2026-10", "2026-11"]);
    expect(series[0]).toEqual({ month: "2026-10", income: 6500, expense: 2000, net: 4500 });
    expect(series[1].income).toBe(800);
  });
  it("forecasts only with enough history", () => {
    expect(naiveForecast([{ income: 100, expense: 50 }])).toBeNull();
    expect(naiveForecast([{ income: 100, expense: 50 }, { income: 300, expense: 50 }])).toEqual({ income: 200, expense: 50, net: 150, basedOnMonths: 2 });
  });
  it("category breakdown, margin, scenarios", () => {
    expect(byCategory(txs, "INCOME")[0]).toEqual({ category: "academy", amount: 5500 });
    expect(margin(1000, 750)).toBe(25);
    expect(margin(0, 10)).toBeNull();
    expect(priceScenario({ baseRevenue: 10000, priceChangePct: 10, volumeChangePct: -5 })).toBe(10450);
  });
});

describe("CSV safety", () => {
  it("neutralises formula injection and quotes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsv(["a"], [["x"]]).startsWith("﻿")).toBe(true);
  });
});

import { whatsappNumber } from "@/components/contact-buttons";
describe("whatsappNumber", () => {
  it("builds wa.me numbers from stored and local formats", () => {
    expect(whatsappNumber("+972521234567")).toBe("972521234567");
    expect(whatsappNumber("052-123-4567")).toBe("972521234567");
    expect(whatsappNumber("00972521234567")).toBe("972521234567");
  });
});

import { clubProgress, fitsWindow, isReferralCode, makeReferralCode, parseClub, qualifyingVisits, rewardText } from "@/domain/experience";
describe("CASTEL CLUB rules", () => {
  it("is off by default with safe defaults", () => {
    expect(parseClub({})).toMatchObject({ enabled: false, visitsRequired: 10, premiumQualifies: false });
    expect(parseClub({ visitsRequired: -3 }).visitsRequired).toBe(10);
  });
  it("counts only completed visits, one per day, premium only when allowed", () => {
    const a = [
      { status: "COMPLETED", dayKey: "2027-01-01", premium: false },
      { status: "COMPLETED", dayKey: "2027-01-01", premium: false }, // duplicate same day
      { status: "CANCELLED", dayKey: "2027-01-02", premium: false },
      { status: "NO_SHOW", dayKey: "2027-01-03", premium: false },
      { status: "COMPLETED", dayKey: "2027-01-04", premium: true },
      { status: "SCHEDULED", dayKey: "2027-01-05", premium: false },
    ];
    expect(qualifyingVisits(a, { premiumQualifies: false })).toBe(1);
    expect(qualifyingVisits(a, { premiumQualifies: true })).toBe(2);
  });
  it("progress and reward text", () => {
    expect(clubProgress(23, 10)).toEqual({ cycles: 2, inCard: 3, remaining: 7, required: 10 });
    expect(rewardText({ rewardLabel: "", rewardType: "discount_percent", rewardValue: 50 })).toBe("50% הנחה על תספורת");
    expect(rewardText({ rewardLabel: "קפה ותספורת", rewardType: "gift", rewardValue: 0 })).toBe("קפה ותספורת");
  });
  it("referral codes and waitlist windows", () => {
    const c = makeReferralCode();
    expect(isReferralCode(c)).toBe(true);
    expect(isReferralCode("CS-0OI1AA")).toBe(false);
    expect(fitsWindow(600, 540, 720)).toBe(true);
    expect(fitsWindow(720, 540, 720)).toBe(false);
  });
});

import { googleCalendarUrl, isGiftCode, liveState, makeGiftCode, parseGifts, parseSurprise, pickSurprise } from "@/domain/experience";
describe("client features rules", () => {
  const now = new Date("2027-03-02T08:00:00Z");
  const appt = (o: Record<string, unknown>) => ({ status: "CONFIRMED", startsAt: new Date("2027-03-02T12:00:00Z"), endsAt: new Date("2027-03-02T12:30:00Z"), ...o }) as any;
  it("live status only from real data", () => {
    expect(liveState(appt({ status: "SCHEDULED" }), now)).toBe("pending");
    expect(liveState(appt({}), now)).toBe("confirmed");
    expect(liveState(appt({ startsAt: new Date("2027-03-02T09:30:00Z") }), now)).toBe("soon");
    expect(liveState(appt({ liveStatus: "delay", liveUpdatedAt: new Date("2027-03-02T07:50:00Z") }), now)).toBe("delay");
    expect(liveState(appt({ liveStatus: "ready", liveUpdatedAt: new Date("2027-02-20T07:50:00Z") }), now)).toBe("confirmed"); // stale flag ignored
    expect(liveState(appt({ status: "CANCELLED", liveStatus: "ready", liveUpdatedAt: now }), now)).toBe("cancelled");
  });
  it("surprise and gift settings are off by default; picks are owner-approved", () => {
    expect(parseSurprise({}).enabled).toBe(false);
    expect(parseGifts({}).enabled).toBe(false);
    const r = [{ label: "10% הנחה", weight: 3 }, { label: "שדרוג", weight: 1 }];
    expect(pickSurprise(r, 0)).toBe("10% הנחה");
    expect(pickSurprise(r, 0.99)).toBe("שדרוג");
    expect(pickSurprise([], 0.5)).toBeNull();
    expect(isGiftCode(makeGiftCode())).toBe(true);
    expect(googleCalendarUrl({ title: "x", start: new Date("2027-03-02T12:00:00Z"), end: new Date("2027-03-02T12:30:00Z") })).toContain("20270302T120000Z%2F20270302T123000Z");
  });
});
