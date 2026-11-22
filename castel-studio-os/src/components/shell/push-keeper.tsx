"use client";
import { useEffect } from "react";

const b64ToUint8 = (b64: string) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };

/**
 * Keeps this device's booking notifications alive without the owner doing anything.
 * Phones (especially iPhone) can silently renew or drop a push subscription; the server then removes the dead one.
 * Whenever the app opens or returns to the foreground (at most every 6 hours), if notifications are allowed,
 * we make sure a subscription exists and that the server has the current one.
 */
export function PushKeeper({ vapidKey }: { vapidKey: string }) {
  useEffect(() => {
    if (!vapidKey || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const KEY = "castel.push.synced";
    const sync = async (force = false) => {
      if (Notification.permission !== "granted") return;
      try { if (!force && Date.now() - Number(localStorage.getItem(KEY) || 0) < 6 * 3600_000) return; } catch { /* private mode */ }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) }));
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json", "X-Push-Keepalive": "1" }, body: JSON.stringify(sub.toJSON()) });
      if (r.ok) try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    };
    sync().catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") sync().catch(() => {}); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [vapidKey]);
  return null;
}
