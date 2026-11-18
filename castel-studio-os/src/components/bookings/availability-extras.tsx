import { formatDateTime } from "@/lib/utils";
import { toLocalInput } from "@/lib/dates";
import { addTimeOffAction, removeDateOverrideAction, removeTimeOffAction, saveDateOverrideAction } from "@/server/actions/online-booking";
import { ActionForm, InlineAction, SubmitButton } from "@/components/forms";
import { Card, CardTitle, Input, Label, Select } from "@/components/ui";

type Override = { id: string; date: string; staffId: string | null; closed: boolean; windows: unknown; note: string | null };
type Off = { id: string; startsAt: Date; endsAt: Date; reason: string | null; staff: { name: string } | null };

/** Special dates + holidays/time off — shared by "Working hours" and "Online booking". */
export function AvailabilityExtras({ he, locale, edit, staff, overrides, offs, todayKey }: { he: boolean; locale: string; edit: boolean; staff: { id: string; name: string }[]; overrides: Override[]; offs: Off[]; todayKey: string }) {
  const L = (h: string, e: string) => (he ? h : e);
  const staffName = (id: string | null) => (id ? staff.find((x) => x.id === id)?.name ?? "—" : null);
  return (
    <>
        <Card>
          <CardTitle>{L("תאריכים מיוחדים", "Special dates")}</CardTitle>
          <p className="mb-3 text-xs text-muted">{L("שעות אחרות ליום מסוים (ערב חג, יום ארוך) או סגירה, בלי לשנות את השבוע הקבוע.", "Different hours for one date (holiday eve, long day) or closed, without changing the weekly schedule.")}</p>
          {edit && (
            <ActionForm action={saveDateOverrideAction} className="space-y-2" resetOnSuccess>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{L("תאריך", "Date")}</Label><Input type="date" name="date" required dir="ltr" min={todayKey} /></div>
                <div><Label>{L("מה קורה ביום הזה", "That day")}</Label><Select name="mode" defaultValue="hours"><option value="hours">{L("שעות מיוחדות", "Special hours")}</option><option value="closed">{L("סגור", "Closed")}</option></Select></div>
                <div><Label>{L("פתיחה", "Open")}</Label><Input type="time" name="start" defaultValue="09:00" dir="ltr" step={300} /></div>
                <div><Label>{L("סגירה", "Close")}</Label><Input type="time" name="end" defaultValue="14:00" dir="ltr" step={300} /></div>
                <div><Label>{L("הפסקה מ- (לא חובה)", "Break from (optional)")}</Label><Input type="time" name="breakStart" dir="ltr" step={300} /></div>
                <div><Label>{L("עד", "to")}</Label><Input type="time" name="breakEnd" dir="ltr" step={300} /></div>
                <div><Label>{L("⭐ פרימיום מ- (לא חובה)", "⭐ Premium from (optional)")}</Label><Input type="time" name="premiumStart" dir="ltr" step={300} /></div>
                <div><Label>{L("עד", "to")}</Label><Input type="time" name="premiumEnd" dir="ltr" step={300} /></div>
                <div><Label>{L("למי", "Who")}</Label><Select name="staffId"><option value="">{L("כל המספרה", "Whole shop")}</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
                <div><Label>{L("הערה", "Note")}</Label><Input name="note" maxLength={120} placeholder={L("ערב חג", "Holiday eve")} /></div>
              </div>
              <SubmitButton size="sm">{L("שמירת התאריך", "Save date")}</SubmitButton>
            </ActionForm>
          )}
          <ul className="mt-3 space-y-2">
            {overrides.length === 0 && <li className="text-sm text-muted">{L("אין תאריכים מיוחדים.", "No special dates.")}</li>}
            {overrides.map((o) => {
              const ws = (Array.isArray(o.windows) ? o.windows : []) as { start: string; end: string; kind?: string }[];
              return (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="min-w-0"><b dir="ltr">{o.date.split("-").reverse().join(".")}</b> · {staffName(o.staffId) ?? L("כל המספרה", "Whole shop")} · {o.closed ? <span className="text-danger">{L("סגור", "Closed")}</span> : <span dir="ltr">{ws.map((w) => `${w.kind === "premium" ? "⭐" : ""}${w.start}–${w.end}`).join(", ")}</span>}{o.note ? ` · ${o.note}` : ""}</span>
                  {edit && <InlineAction action={removeDateOverrideAction} fields={{ id: o.id }} confirm={L("למחוק?", "Delete?")}>✕</InlineAction>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>{L("חופשות וימים סגורים", "Holidays & time off")}</CardTitle>
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

    </>
  );
}
