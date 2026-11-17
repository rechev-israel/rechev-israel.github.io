"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelBooking({ token, labels }: { token: string; labels: Record<"cancel" | "confirm" | "tooLate" | "error", string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    if (!window.confirm(labels.confirm)) return;
    setBusy(true);
    const r = await fetch("/api/public/booking/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    if (r?.ok) { router.refresh(); return; }
    const d = r ? await r.json().catch(() => ({})) : {};
    setMsg(d.error === "too_late" ? labels.tooLate : labels.error);
    setBusy(false);
  };
  return (
    <>
      <button type="button" onClick={go} disabled={busy} className="h-11 rounded-xl border border-danger/40 text-sm text-danger disabled:opacity-50">{labels.cancel}</button>
      {msg && <p role="alert" className="text-center text-xs text-danger">{msg}</p>}
    </>
  );
}
