import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { toLocalInput } from "@/lib/dates";
import { formatDateTime, formatILS } from "@/lib/utils";
import { getBookingSettings } from "@/server/services/online-booking";
import { addTimeOffAction, removeTimeOffAction, saveBookingSettingsAction, saveHoursAction, setServiceOnlineAction, setStaffBookableAction } from "@/server/actions/online-booking";
import { appOrigin } from "@/server/integrations/origin";
import { ActionForm, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, Input, Label, Notice, PageHeader, Select, Textarea, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Online booking" };
export const dynamic = "force-dynamic";

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function HoursForm({ rules, staffId, he, allowShop }: { rules: { weekday: number; startTime: string; endTime: string }[]; staffId?: string; he: boolean; allowShop?: boolean }) {
  const L = (h: string, e: string) => (he ? h : e);
  return (
    <ActionForm action={saveHoursAction} className="space-y-2">
      {staffId && <input type="hidden" name="staffId" value={staffId} />}
      {allowShop && <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="useShop" className="h-4 w-4 accent-[var(--gold)]" /> {L("להשתמש בשעות המספרה (מחיקת שעות אישיות)", "Use shop hours (remove personal hours)")}</label>}
      {[0, 1, 2, 3, 4, 5, 6].map((w) => {
        const r = rules.find((x) => x.weekday === w);
        return (
          <div key={w} className="grid grid-cols-[72px_1fr_1fr] items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name={`open_${w}`} defaultChecked={Boolean(r)} className="h-4 w-4 accent-[var(--gold)]" />{(he ? DAYS_HE : DAYS_EN)[w]}</label>
            <Input type="time" name={`start_${w}`} defaultValue={r?.startTime ?? "09:00"} dir="ltr" step={300} aria-label="start" />
            <Input type="time" name={`end_${w}`} defaultValue={r?.endTime ?? "20:00"} dir="ltr" step={300} aria-label="end" />
          </div>
        );
      })}
      <SubmitButton size="sm">{L("שמירת שעות", "Save hours")}</SubmitButton>
    </ActionForm>
  );
}

export default async function OnlineBookingPage() {
  const { user, t, locale, allowed } = await pageGuard("bookings.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const edit = can(user.role, "services.edit");
  const branch = await db.branch.findFirst({ where: { businessId: user.businessId, isActive: true }, orderBy: { createdAt: "asc" } });
  const [settings, staff, rules, services, offs, upcoming] = await Promise.all([
    getBookingSettings(user.businessId),
    db.user.findMany({ where: { businessId: user.businessId, isActive: true, role: { in: ["OWNER", "MANAGER", "BARBER", "INSTRUCTOR"] } }, select: { id: true, name: true, acceptsBookings: true }, orderBy: { createdAt: "asc" } }),
    branch ? db.availabilityRule.findMany({ where: { branchId: branch.id, isActive: true }, orderBy: { weekday: "asc" } }) : [],
    db.service.findMany({ where: { businessId: user.businessId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] }),
    db.timeOff.findMany({ where: { businessId: user.businessId, endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, include: { staff: { select: { name: true } } } }),
    db.appointment.count({ where: { businessId: user.businessId, source: "online", startsAt: { gt: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
  ]);
  const link = `${appOrigin()}/book`;
  const shopRules = rules.filter((r) => !r.staffId);
  const bookableCount = staff.filter((s) => s.acceptsBookings).length;
  const onlineServices = services.filter((s) => s.bookableOnline).length;
  const problems = [
    !services.length && L("אין שירותים פעילים — הוסיפו שירותים ומחירים.", "No active services — add services and prices."),
    services.length > 0 && !onlineServices && L("אף שירות לא מסומן להזמנה אונליין.", "No service is offered online."),
    !shopRules.length && L("לא הוגדרו שעות פתיחה.", "No opening hours set."),
    settings.enabled && !bookableCount && L("אין ספר שמקבל תורים.", "No barber accepts bookings."),
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title={L("קביעת תורים אונליין", "Online booking")}
        subtitle={L("מערכת התורים של CASTEL STUDIO: הלקוחות קובעים לבד, הכל נכנס ישר ליומן, ללקוחות ולכספים.", "Customers book themselves; everything lands in the calendar, CRM and finance.")}
        actions={<><Link href="/book" target="_blank" className={buttonClass("secondary")}><ExternalLink size={14} /> {L("צפייה בדף ההזמנה", "Open booking page")}</Link><Link href="/bookings/services" className={buttonClass("ghost")}>{L("שירותים ומחירים", "Services & prices")}</Link></>}
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold"><Globe size={16} className="text-gold" /> {L("דף ההזמנה שלך", "Your booking page")} <Badge tone={settings.enabled ? "success" : "neutral"}>{settings.enabled ? L("פתוח ללקוחות", "Open") : L("סגור", "Closed")}</Badge></p>
            <code dir="ltr" className="mt-1 block select-all break-all text-sm text-gold">{link}</code>
            <p className="mt-1 text-xs text-muted">{L("שימו את הקישור בביו של האינסטגרם, בוואטסאפ העסקי ובכפתור ״קביעת תור״ באתר.", "Put this link in your Instagram bio, WhatsApp Business and the site's Book button.")} · {L("תורים עתידיים שנקבעו אונליין", "Upcoming online bookings")}: <b>{upcoming}</b></p>
          </div>
        </div>
        {problems.length > 0 && <Notice tone="warning" className="mt-3">{problems.join(" · ")}</Notice>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>{L("1. הגדרות", "1. Settings")}</CardTitle>
          <ActionForm action={saveBookingSettingsAction} className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} disabled={!edit} className="h-5 w-5 accent-[var(--gold)]" /> {L("פתיחת קביעת תורים אונליין ללקוחות", "Open online booking to customers")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoConfirm" defaultChecked={settings.autoConfirm} disabled={!edit} className="h-4 w-4 accent-[var(--gold)]" /> {L("אישור אוטומטי (בלי אישור ידני של כל תור)", "Auto-confirm (no manual approval per booking)")}</label>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{L("מרווח בין שעות (דק׳)", "Slot step (min)")}</Label><Select name="slotStepMin" defaultValue={String(settings.slotStepMin)}>{[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
              <div><Label>{L("הפסקה בין תורים (דק׳)", "Buffer (min)")}</Label><Select name="bufferMin" defaultValue={String(settings.bufferMin)}>{[0, 5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
              <div><Label>{L("הזמנה לפחות (שעות) מראש", "Min notice (hours)")}</Label><Select name="minNoticeMin" defaultValue={String(settings.minNoticeMin)}>{[0, 30, 60, 120, 180, 360, 720, 1440].map((n) => <option key={n} value={n}>{n < 60 ? `${n} ${L("דק׳", "min")}` : n / 60}</option>)}</Select></div>
              <div><Label>{L("כמה ימים קדימה", "Days ahead")}</Label><Select name="maxDaysAhead" defaultValue={String(settings.maxDaysAhead)}>{[7, 14, 21, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
              <div><Label>{L("ביטול אונליין עד (שעות לפני)", "Online cancel until (h before)")}</Label><Select name="cancelNoticeMin" defaultValue={String(settings.cancelNoticeMin)}>{[0, 60, 120, 180, 360, 720, 1440, 2880].map((n) => <option key={n} value={n}>{n / 60}</option>)}</Select></div>
              <div><Label>{L("מקס׳ תורים פתוחים ללקוח", "Max open bookings per customer")}</Label><Select name="maxActivePerPhone" defaultValue={String(settings.maxActivePerPhone)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
            </div>
            <div><Label>{L("טלפון המספרה (מוצג ללקוחות)", "Shop phone (shown to customers)")}</Label><Input name="shopPhone" dir="ltr" inputMode="tel" maxLength={20} defaultValue={branch?.phone ?? ""} placeholder="050-0000000" /></div>
            <div><Label>{L("הודעה בראש דף ההזמנה (עברית)", "Note on booking page (Hebrew)")}</Label><Textarea name="noteHe" rows={2} maxLength={500} defaultValue={settings.noteHe ?? ""} placeholder={L("לדוגמה: איחור של יותר מ-10 דקות עלול לבטל את התור.", "e.g. Arriving 10+ min late may cancel the booking.")} /></div>
            <div><Label>{L("הודעה (אנגלית)", "Note (English)")}</Label><Textarea name="noteEn" rows={2} maxLength={500} defaultValue={settings.noteEn ?? ""} /></div>
            {edit && <SubmitButton>{t.common.save}</SubmitButton>}
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>{L("2. שעות פתיחה של המספרה", "2. Shop opening hours")}</CardTitle>
          {edit ? <HoursForm rules={shopRules} he={he} /> : <p className="text-sm text-muted">—</p>}
        </Card>

        <Card>
          <CardTitle>{L("3. ספרים שמקבלים תורים", "3. Barbers taking bookings")}</CardTitle>
          <div className="space-y-3">
            {staff.map((s) => {
              const own = rules.filter((r) => r.staffId === s.id);
              return (
                <div key={s.id} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.acceptsBookings ? "success" : "neutral"}>{s.acceptsBookings ? L("מקבל תורים", "Bookable") : L("לא מקבל", "Not bookable")}</Badge>
                      {edit && <InlineAction action={setStaffBookableAction} fields={{ id: s.id, on: s.acceptsBookings ? "0" : "1" }}>{s.acceptsBookings ? L("כיבוי", "Turn off") : L("הפעלה", "Turn on")}</InlineAction>}
                    </div>
                  </div>
                  {edit && s.acceptsBookings && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gold">{own.length ? L("שעות אישיות (מוגדרות)", "Personal hours (set)") : L("שעות אישיות — כרגע לפי שעות המספרה", "Personal hours — currently shop hours")}</summary>
                      <div className="mt-2"><HoursForm rules={own.length ? own : shopRules} staffId={s.id} he={he} allowShop={own.length > 0} /></div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>{L("4. חופשות וימים סגורים", "4. Holidays & time off")}</CardTitle>
          {edit && (
            <ActionForm action={addTimeOffAction} className="space-y-2" resetOnSuccess>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{L("מ-", "From")}</Label><Input type="datetime-local" name="from" required dir="ltr" defaultValue={toLocalInput(new Date()).slice(0, 11) + "00:00"} /></div>
                <div><Label>{L("עד", "To")}</Label><Input type="datetime-local" name="to" required dir="ltr" defaultValue={toLocalInput(new Date()).slice(0, 11) + "23:59"} /></div>
                <div><Label>{L("למי", "Who")}</Label><Select name="staffId"><option value="">{L("כל המספרה", "Whole shop")}</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
                <div><Label>{L("סיבה", "Reason")}</Label><Input name="reason" maxLength={120} placeholder={L("חג / חופשה", "Holiday / vacation")} /></div>
              </div>
              <SubmitButton size="sm">{L("הוספה", "Add")}</SubmitButton>
            </ActionForm>
          )}
          <ul className="mt-3 space-y-2">
            {offs.length === 0 && <li className="text-sm text-muted">{L("אין חופשות מתוכננות.", "No upcoming time off.")}</li>}
            {offs.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="min-w-0"><b>{o.staff?.name ?? L("כל המספרה", "Whole shop")}</b> · {formatDateTime(o.startsAt, locale)} → {formatDateTime(o.endsAt, locale)}{o.reason ? ` · ${o.reason}` : ""}</span>
                {edit && <InlineAction action={removeTimeOffAction} fields={{ id: o.id }} confirm={L("למחוק?", "Delete?")}>✕</InlineAction>}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>{L("5. שירותים בדף ההזמנה", "5. Services on the booking page")}</CardTitle>
          {services.length === 0 ? <p className="text-sm text-muted">{L("אין שירותים עדיין.", "No services yet.")} <Link href="/bookings/services" className="text-gold underline">{L("הוספת שירות", "Add a service")}</Link></p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{he ? s.nameHe : s.nameEn} · {s.durationMin}′ · {formatILS(s.price, locale)}</span>
                  {edit ? <InlineAction action={setServiceOnlineAction} fields={{ id: s.id, on: s.bookableOnline ? "0" : "1" }}>{s.bookableOnline ? L("✓ מוצג", "✓ Shown") : L("מוסתר", "Hidden")}</InlineAction> : <Badge>{s.bookableOnline ? "✓" : "—"}</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
