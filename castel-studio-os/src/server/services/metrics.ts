import { db } from "@/lib/db";
import { addDays, addMonths, monthKey, startOfDay, startOfMonth } from "@/lib/dates";
import { toNumber } from "@/lib/utils";
import { summarize, monthlySeries, naiveForecast, byCategory, margin, type Tx } from "@/domain/finance";
import { SEGMENT_RULES, upcomingBirthday } from "@/domain/crm";

export async function getTransactions(businessId: string, from: Date, to?: Date): Promise<Tx[]> {
  const rows = await db.transaction.findMany({
    where: { businessId, occurredAt: { gte: from, ...(to ? { lt: to } : {}) } },
    select: { type: true, kind: true, amount: true, occurredAt: true, category: true },
  });
  return rows.map((r) => ({ ...r, amount: toNumber(r.amount) }));
}

export function lastMonths(n: number, now = new Date()) {
  const start = startOfMonth(now);
  return Array.from({ length: n }, (_, i) => monthKey(addMonths(start, i - (n - 1))));
}

export async function getDashboardMetrics(businessId: string, now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const monthStart = startOfMonth(now);
  const sixMonthsAgo = addMonths(monthStart, -5);
  const atRiskCutoff = new Date(now.getTime() - SEGMENT_RULES.atRiskDays * 86400_000);
  const thirtyAgo = new Date(now.getTime() - 30 * 86400_000);

  const [
    txs6m,
    apptsToday,
    apptsWeek,
    activeCustomers,
    newCustomers,
    atRisk,
    birthdayCandidates,
    activeStudents,
    openLeads,
    newLeads,
    pendingApprovals,
    noShows30,
    upcoming,
    openTasks,
    enrollments,
  ] = await Promise.all([
    getTransactions(businessId, sixMonthsAgo),
    db.appointment.count({ where: { businessId, startsAt: { gte: today, lt: tomorrow }, status: { notIn: ["CANCELLED"] } } }),
    db.appointment.count({ where: { businessId, startsAt: { gte: today, lt: weekEnd }, status: { notIn: ["CANCELLED"] } } }),
    db.customer.count({ where: { businessId, archivedAt: null, status: { not: "BLOCKED" } } }),
    db.customer.count({ where: { businessId, createdAt: { gte: monthStart } } }),
    db.customer.count({ where: { businessId, archivedAt: null, lastVisitAt: { lt: atRiskCutoff }, status: { not: "BLOCKED" } } }),
    db.customer.findMany({ where: { businessId, archivedAt: null, birthday: { not: null } }, select: { birthday: true } }),
    db.student.count({ where: { businessId, status: { in: ["ENROLLED", "ACTIVE"] } } }),
    db.lead.count({ where: { businessId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } } }),
    db.lead.count({ where: { businessId, status: "NEW" } }),
    db.approvalRequest.count({ where: { businessId, status: "PENDING" } }),
    db.appointment.count({ where: { businessId, status: "NO_SHOW", startsAt: { gte: thirtyAgo } } }),
    db.appointment.findMany({
      where: { businessId, startsAt: { gte: now }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: { customer: { select: { id: true, firstName: true, lastName: true } }, service: { select: { nameHe: true, nameEn: true } } },
    }),
    db.task.findMany({ where: { businessId, status: { not: "DONE" } }, orderBy: [{ priority: "asc" }, { dueAt: "asc" }], take: 6 }),
    db.enrollment.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED"] }, student: { businessId } },
      select: { agreedPrice: true, payments: { select: { amount: true } } },
    }),
  ]);

  const monthTx = txs6m.filter((t) => t.occurredAt >= monthStart);
  const todayTx = txs6m.filter((t) => t.occurredAt >= today && t.occurredAt < tomorrow);
  const month = summarize(monthTx);
  const day = summarize(todayTx);
  const months = lastMonths(6, now);
  const series = monthlySeries(txs6m, months);
  const completeMonths = series.slice(0, -1); // exclude current partial month
  const unpaidStudents = enrollments.filter(
    (e) => toNumber(e.agreedPrice) - e.payments.reduce((s, p) => s + toNumber(p.amount), 0) > 0,
  ).length;
  const birthdays = birthdayCandidates.filter((c) => upcomingBirthday(c.birthday, now, 14) !== null).length;

  return {
    revenueToday: day.actual.income,
    revenueMonth: month.actual.income,
    expensesMonth: month.actual.expense,
    netMonth: month.actual.net,
    marginMonth: margin(month.actual.income, month.actual.expense),
    estimatesMonth: month.estimate,
    apptsToday,
    apptsWeek,
    activeCustomers,
    newCustomers,
    activeStudents,
    openLeads,
    series,
    forecast: naiveForecast(completeMonths),
    incomeByCategory: byCategory(monthTx, "INCOME"),
    expenseByCategory: byCategory(monthTx, "EXPENSE"),
    alerts: { atRisk, birthdays, unpaidStudents, newLeads, pendingApprovals, noShows30 },
    upcoming,
    openTasks,
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;

/** Rule-based insights — always available, no AI provider required. Keys map to i18n strings in the UI. */
export function ruleInsights(m: DashboardMetrics) {
  const out: { level: "info" | "warn" | "good"; he: string; en: string }[] = [];
  if (m.marginMonth !== null && m.marginMonth < 20)
    out.push({ level: "warn", he: `שולי הרווח החודש ${m.marginMonth}% — מתחת ל-20%. כדאי לבדוק הוצאות קבועות ותמחור.`, en: `Profit margin this month is ${m.marginMonth}% — below 20%. Review fixed costs and pricing.` });
  if (m.alerts.atRisk > 0)
    out.push({ level: "warn", he: `${m.alerts.atRisk} לקוחות לא ביקרו מעל 45 יום. קמפיין חזרה ממוקד (בהסכמה בלבד) עשוי להחזיר חלק מהם.`, en: `${m.alerts.atRisk} customers haven't visited in 45+ days. A targeted win-back campaign (opted-in only) may recover some.` });
  if (m.alerts.newLeads > 0)
    out.push({ level: "info", he: `${m.alerts.newLeads} לידים חדשים לאקדמיה. מענה תוך 24 שעות משפר משמעותית את ההמרה.`, en: `${m.alerts.newLeads} new academy leads. Responding within 24 hours significantly improves conversion.` });
  if (m.alerts.noShows30 >= 3)
    out.push({ level: "warn", he: `${m.alerts.noShows30} אי-הגעות בחודש האחרון. שקלו תזכורת יום לפני ומדיניות פיקדון.`, en: `${m.alerts.noShows30} no-shows in the last month. Consider day-before reminders and a deposit policy.` });
  if (m.forecast && m.forecast.net > 0)
    out.push({ level: "good", he: `לפי ממוצע ${m.forecast.basedOnMonths} החודשים האחרונים, הרווח הצפוי לחודש הבא כ-₪${m.forecast.net.toLocaleString("he-IL")} (הערכה).`, en: `Based on the last ${m.forecast.basedOnMonths} months, expected net next month is about ₪${m.forecast.net.toLocaleString("en-IL")} (estimate).` });
  return out;
}

/** Aggregated, non-identifying context for AI agents. Never includes names, phones or emails. */
export async function buildAiContext(businessId: string, scopes: string[], allowFinance: boolean) {
  const m = await getDashboardMetrics(businessId);
  const ctx: Record<string, unknown> = {
    business: { name: "CASTEL STUDIO", category: "Premium men's barbershop & barber academy", city: "Ashkelon, Israel", currency: "ILS" },
  };
  if (scopes.includes("overview") || scopes.includes("bookings")) {
    ctx.bookings = { appointmentsToday: m.apptsToday, appointmentsNext7Days: m.apptsWeek, noShowsLast30Days: m.alerts.noShows30 };
  }
  if (scopes.includes("crm") || scopes.includes("overview")) {
    ctx.customers = { active: m.activeCustomers, newThisMonth: m.newCustomers, atRisk45Days: m.alerts.atRisk, birthdaysNext14Days: m.alerts.birthdays };
  }
  if (scopes.includes("academy") || scopes.includes("overview")) {
    const courses = await db.course.findMany({ where: { businessId, isActive: true }, select: { nameEn: true, price: true, lessonCount: true, lessonDurations: true, maxStudents: true } });
    ctx.academy = {
      activeStudents: m.activeStudents,
      openLeads: m.openLeads,
      studentsWithOpenBalance: m.alerts.unpaidStudents,
      courses: courses.map((c) => ({ name: c.nameEn, priceILS: toNumber(c.price), lessons: c.lessonCount, totalHours: c.lessonDurations.reduce((a, b) => a + b, 0) / 60, maxStudents: c.maxStudents })),
    };
  }
  if (scopes.includes("finance") && allowFinance) {
    ctx.finance = {
      note: "ACTUAL figures are recorded transactions; forecast is a naive estimate.",
      thisMonthActual: { income: m.revenueMonth, expense: m.expensesMonth, net: m.netMonth, marginPct: m.marginMonth },
      last6MonthsActual: m.series,
      incomeByCategoryThisMonth: m.incomeByCategory,
      expenseByCategoryThisMonth: m.expenseByCategory,
      forecastNextMonthEstimate: m.forecast,
    };
  }
  if (scopes.includes("marketing")) {
    ctx.marketing = { adsPlatformsConnected: false, note: "No Meta/Google Ads data connected — do not invent campaign metrics." };
  }
  return ctx;
}
