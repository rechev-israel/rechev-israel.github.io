"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Scissors, User } from "lucide-react";

type Service = { id: string; name: string; durationMin: number; price: number };
type Staff = { id: string; name: string };
type Slot = { start: number; label: string };

const ERR: Record<string, [string, string]> = {
  slot_taken: ["השעה הזאת נתפסה הרגע. בחרו שעה אחרת.", "That time was just taken. Pick another."],
  phone: ["מספר הטלפון לא תקין.", "Invalid phone number."],
  limit: ["כבר יש לכם תורים פתוחים. לשינוי צרו קשר עם המספרה.", "You already have upcoming bookings. Contact the shop to change."],
  rate_limited: ["יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.", "Too many attempts. Try again in a few minutes."],
  validation: ["נא למלא שם וטלפון ולאשר את התנאים.", "Please fill name and phone and accept the terms."],
  disabled: ["קביעת תורים אונליין סגורה כרגע.", "Online booking is currently closed."],
};

export function BookingWizard({ locale, services, staff, dates }: { locale: string; services: Service[]; staff: Staff[]; dates: string[] }) {
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const router = useRouter();
  const [serviceId, setServiceId] = useState<string>(services.length === 1 ? services[0].id : "");
  const [staffId, setStaffId] = useState<string>(staff.length === 1 ? staff[0].id : "any");
  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const service = services.find((s) => s.id === serviceId);
  const fmtDay = useMemo(() => new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }), [he]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }), [he]);
  const dayDate = (d: string) => new Date(`${d}T12:00:00Z`);

  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    setLoading(true); setSlots(null); setStart(null); setError("");
    fetch(`/api/public/booking/slots?serviceId=${serviceId}&staffId=${staffId}&date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setSlots(Array.isArray(d.slots) ? d.slots : []); })
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [serviceId, staffId, date]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !date || start == null) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/public/booking", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, staffId, date, start, name, phone, notes: notes || undefined, marketingConsent: marketing, terms, website: (document.getElementById("bk-website") as HTMLInputElement)?.value ?? "" }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && data.manageUrl) { router.push(data.manageUrl); return; }
    const m = ERR[data.error as string];
    setError(m ? (he ? m[0] : m[1]) : L("משהו השתבש. נסו שוב.", "Something went wrong. Please try again."));
    if (data.error === "slot_taken") { setStart(null); setDate((d) => d); setSlots(null); fetch(`/api/public/booking/slots?serviceId=${serviceId}&staffId=${staffId}&date=${date}`).then((r) => r.json()).then((d) => setSlots(d.slots ?? [])); }
    setSubmitting(false);
  };

  const step = "rounded-2xl border border-border bg-surface p-4 sm:p-5";
  const chip = (on: boolean) => `min-h-11 rounded-xl border px-3 text-sm transition-colors ${on ? "border-gold bg-gold/15 text-gold" : "border-border bg-surface-2 hover:border-gold/50"}`;
  const H = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <h2 className="mb-3 flex items-center gap-2 font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-gold text-xs font-bold text-black">{n}</span>{children}</h2>
  );

  return (
    <div className="space-y-4">
      <div className={step}>
        <H n={1}>{L("בחירת שירות", "Choose a service")}</H>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <button key={s.id} type="button" onClick={() => { setServiceId(s.id); setStart(null); }} aria-pressed={serviceId === s.id} className={`${chip(serviceId === s.id)} flex items-center justify-between gap-3 py-3 text-start`}>
              <span className="flex min-w-0 items-center gap-2"><Scissors size={15} className="shrink-0 text-gold" /><span className="truncate font-medium">{s.name}</span></span>
              <span className="shrink-0 text-xs text-muted"><Clock size={11} className="inline" /> {s.durationMin}′ · <b className="text-text">₪{s.price}</b></span>
            </button>
          ))}
        </div>
      </div>

      {staff.length > 1 && (
        <div className={step}>
          <H n={2}>{L("בחירת ספר", "Choose a barber")}</H>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(staffId === "any")} onClick={() => setStaffId("any")} aria-pressed={staffId === "any"}>{L("כל ספר פנוי", "Any available")}</button>
            {staff.map((s) => <button key={s.id} type="button" className={chip(staffId === s.id)} onClick={() => setStaffId(s.id)} aria-pressed={staffId === s.id}><User size={13} className="inline" /> {s.name}</button>)}
          </div>
        </div>
      )}

      {service && (
        <div className={step}>
          <H n={staff.length > 1 ? 3 : 2}>{L("בחירת יום", "Choose a day")}</H>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {dates.map((d) => <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={date === d} className={`${chip(date === d)} shrink-0 whitespace-nowrap`}>{fmtDay.format(dayDate(d))}</button>)}
          </div>
        </div>
      )}

      {service && date && (
        <div className={step}>
          <H n={staff.length > 1 ? 4 : 3}>{L("בחירת שעה", "Choose a time")} <span className="text-xs font-normal text-muted">· {fmtLong.format(dayDate(date))}</span></H>
          {loading || slots === null ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> {L("טוען שעות פנויות…", "Loading available times…")}</p>
            : slots.length === 0 ? <p className="text-sm text-muted">{L("אין שעות פנויות ביום הזה. נסו יום אחר.", "No free times on this day. Try another day.")}</p>
            : <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{slots.map((s) => <button key={s.start} type="button" dir="ltr" onClick={() => setStart(s.start)} aria-pressed={start === s.start} className={`${chip(start === s.start)} tabular-nums`}>{s.label}</button>)}</div>}
        </div>
      )}

      {service && date && start != null && (
        <form onSubmit={submit} className={step} noValidate>
          <H n={staff.length > 1 ? 5 : 4}>{L("פרטים ואישור", "Your details")}</H>
          <p className="mb-3 rounded-lg bg-surface-2 p-3 text-sm"><b>{service.name}</b> · {fmtLong.format(dayDate(date))} · <span dir="ltr">{slots?.find((s) => s.start === start)?.label}</span> · ₪{service.price}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">{L("שם מלא", "Full name")}<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" className="mt-1 h-11 w-full rounded-lg border border-border bg-surface-2 px-3 focus:border-gold/70 focus:outline-none" /></label>
            <label className="block text-sm">{L("טלפון נייד", "Mobile phone")}<input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" dir="ltr" placeholder="050-0000000" className="mt-1 h-11 w-full rounded-lg border border-border bg-surface-2 px-3 focus:border-gold/70 focus:outline-none" /></label>
            <label className="block text-sm sm:col-span-2">{L("הערה (לא חובה)", "Note (optional)")}<input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface-2 px-3 focus:border-gold/70 focus:outline-none" /></label>
          </div>
          <input id="bk-website" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <label className="mt-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" /> {L("אני מאשר/ת שמירת הפרטים לצורך ניהול התור וקבלת אישור ותזכורת לתור.", "I agree that my details are stored to manage this booking and to receive a confirmation and reminder.")}</label>
          <label className="mt-2 flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" /> {L("אשמח לקבל עדכונים ומבצעים (לא חובה, אפשר להסיר בכל עת).", "Send me news and offers (optional, unsubscribe anytime).")}</label>
          {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={submitting || !terms || name.trim().length < 2 || phone.trim().length < 9} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold font-semibold text-black transition-opacity disabled:opacity-40">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {L("קביעת התור", "Confirm booking")}
          </button>
        </form>
      )}
    </div>
  );
}
