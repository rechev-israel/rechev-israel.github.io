import Link from "next/link";
import { Coffee, Star } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { toLocalInput } from "@/lib/dates";
import { weekModel } from "@/lib/schedule-model";
import { getBookingSettings, syncPremiumService } from "@/server/services/online-booking";
import { saveScheduleAction } from "@/server/actions/online-booking";
import { WeekEditor } from "@/components/bookings/week-editor";
import { AvailabilityExtras } from "@/components/bookings/availability-extras";
import { Card, CardTitle, PageHeader, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "שעות פעילות" };
export const dynamic = "force-dynamic";

/** One place for the owner to control when appointments can be booked: weekly hours, breaks, premium, dates, holidays. */
export default async function HoursPage() {
  const { user, t, locale, allowed } = await pageGuard("bookings.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const edit = can(user.role, "services.edit");
  const branch = await db.branch.findFirst({ where: { businessId: user.businessId, isActive: true }, orderBy: { createdAt: "asc" } });
  const todayKey = toLocalInput(new Date(), false);
  const [settings, rules, staff, overrides, offs] = await Promise.all([
    getBookingSettings(user.businessId),
    branch ? db.availabilityRule.findMany({ where: { branchId: branch.id, isActive: true }, orderBy: { weekday: "asc" } }) : [],
    db.user.findMany({ where: { businessId: user.businessId, isActive: true, acceptsBookings: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.dateOverride.findMany({ where: { businessId: user.businessId, date: { gte: todayKey } }, orderBy: { date: "asc" } }),
    db.timeOff.findMany({ where: { businessId: user.businessId, endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, include: { staff: { select: { name: true } } } }),
  ]);
  const shopRules = rules.filter((r) => !r.staffId);
  await syncPremiumService(user.businessId).catch(() => null);
  const premiumService = await db.service.findFirst({ where: { businessId: user.businessId, externalRef: "auto:premium" } });
  return (
    <>
      <PageHeader
        title={L("שעות פעילות", "Working hours")}
        subtitle={L("כאן קובעים מתי אפשר לקבוע תור: ימים, שעות, הפסקות, שעות פרימיום, תאריכים מיוחדים וחופשות. כל שינוי מתעדכן מיד באתר וביומן.", "When customers can book: days, hours, breaks, premium hours, special dates and holidays. Changes apply instantly to the website and calendar.")}
        actions={<><Link href="/bookings" className={buttonClass("secondary")}>{L("ליומן", "Calendar")}</Link><Link href="/bookings/online" className={buttonClass("ghost")}>{L("הגדרות קביעת תורים", "Booking settings")}</Link></>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:row-span-2">
          <CardTitle>{L("שבוע עבודה קבוע", "Weekly schedule")}</CardTitle>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Coffee size={13} /> {L("הפסקה: בזמן הזה אי אפשר לקבוע תור", "Break: no bookings")}</span>
            <span className="inline-flex items-center gap-1 text-gold"><Star size={13} /> {L("שעות פרימיום: שמורות ל״תור פרימיום״ בלבד", "Premium hours: reserved for the premium appointment")}</span>
          </div>
          {edit ? <WeekEditor initial={weekModel(shopRules)} he={he} action={saveScheduleAction} /> : <p className="text-sm text-muted">{L("רק בעלים/מנהל יכולים לשנות שעות.", "Only owner/manager can edit hours.")}</p>}
          <p className="mt-3 rounded-lg bg-gold/10 p-2.5 text-xs">
            ⭐ {premiumService?.bookableOnline
              ? L(`בשעות הפרימיום הלקוחות קובעים ״${premiumService.nameHe}״ — ₪${Number(premiumService.price)}, ${premiumService.durationMin} דק׳. `, `In premium hours customers book "${premiumService.nameEn}" — ₪${Number(premiumService.price)}, ${premiumService.durationMin} min. `)
              : L("ברגע שתוסיפו שעות פרימיום, יתווסף אוטומטית שירות ״תור פרימיום״ (₪100) שאפשר לקבוע רק בהן. ", "Add premium hours and a \"Premium appointment\" service (₪100) is created automatically. ")}
            <Link href="/bookings/services" className="text-gold underline">{L("שינוי מחיר/משך", "Change price/duration")}</Link>
          </p>
        </Card>
        {staff.length > 1 && (
          <Card>
            <CardTitle>{L("שעות אישיות לספרים", "Personal hours per barber")}</CardTitle>
            <div className="space-y-2">
              {staff.map((s) => {
                const own = rules.filter((r) => r.staffId === s.id);
                return (
                  <details key={s.id} className="rounded-lg border border-border bg-surface-2 p-3">
                    <summary className="cursor-pointer text-sm font-medium">{s.name} <span className="text-xs text-muted">· {own.length ? L("שעות אישיות", "personal hours") : L("לפי שעות המספרה", "shop hours")}</span></summary>
                    {edit && <div className="mt-2"><WeekEditor initial={weekModel(own.length ? own : shopRules)} staffId={s.id} he={he} action={saveScheduleAction} allowShop={own.length > 0} /></div>}
                  </details>
                );
              })}
            </div>
          </Card>
        )}
        <AvailabilityExtras he={he} locale={locale} edit={edit} staff={staff} overrides={overrides} offs={offs} todayKey={todayKey} />
      </div>
    </>
  );
}
