"use client";
import { useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Button } from "@/components/ui";
import { sendTestPushAction } from "@/server/actions/notifications";

type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "server-off";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Enable/disable phone & desktop push for this device, show the real state, and send a test push. */
export function PushSettings({ vapidKey, devices, he }: { vapidKey: string; devices: number; he: boolean }) {
  const L = (h: string, e: string) => (he ? h : e);
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!vapidKey) return setState("server-off");
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [vapidKey]);

  const enable = async () => {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) }));
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error(String(r.status));
      setState("on"); setMsg(L("ההתראות הופעלו במכשיר הזה. שלחו התראת בדיקה כדי לוודא.", "Enabled on this device. Send a test to confirm."));
    } catch (e) {
      setMsg(L("ההפעלה נכשלה: ", "Failed: ") + String(e));
    } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setState("off"); setBusy(false);
  };

  const badge = {
    checking: <Badge>…</Badge>,
    on: <Badge tone="success">{L("פעיל במכשיר הזה", "On for this device")}</Badge>,
    off: <Badge tone="neutral">{L("כבוי במכשיר הזה", "Off for this device")}</Badge>,
    denied: <Badge tone="danger">{L("נחסם בהגדרות", "Blocked")}</Badge>,
    unsupported: <Badge tone="warning">{L("לא נתמך בדפדפן הזה", "Not supported here")}</Badge>,
    "ios-install": <Badge tone="warning">{L("נדרש להוסיף למסך הבית", "Add to Home Screen first")}</Badge>,
    "server-off": <Badge tone="warning">{L("לא הוגדר בשרת", "Not configured on server")}</Badge>,
  }[state];

  return (
    <div className="rounded-2xl border border-gold/30 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><Smartphone size={16} className="text-gold" /> {L("התראות לטלפון", "Phone notifications")}</p>
        {badge}
      </div>
      <p className="mt-1 text-xs text-muted">{L(`מקבלים התראה בכל תור חדש, ביטול או הזזה. מכשירים רשומים: ${devices}.`, `Get notified for every new booking, cancellation or reschedule. Registered devices: ${devices}.`)}</p>
      {state === "ios-install" && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">{L("באייפון: פתחו את האתר בספארי ← כפתור השיתוף ← ״הוספה למסך הבית״. פתחו את האפליקציה ממסך הבית וחזרו לעמוד הזה.", "On iPhone: open in Safari → Share → \"Add to Home Screen\". Open the app from the Home Screen and come back here.")}</p>}
      {state === "denied" && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">{L("ההרשאה נחסמה. אפשרו התראות לאתר בהגדרות המכשיר/הדפדפן ונסו שוב.", "Permission blocked. Allow notifications for this site in settings and retry.")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "off" && <Button type="button" onClick={enable} disabled={busy}><BellRing size={14} /> {L("הפעלת התראות במכשיר הזה", "Enable on this device")}</Button>}
        {state === "on" && <Button type="button" variant="ghost" onClick={disable} disabled={busy}>{L("כיבוי במכשיר הזה", "Turn off on this device")}</Button>}
        {(state === "on" || devices > 0) && <ActionForm action={sendTestPushAction}><SubmitButton variant="secondary" pendingLabel="…">{L("שליחת התראת בדיקה", "Send test notification")}</SubmitButton></ActionForm>}
      </div>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
