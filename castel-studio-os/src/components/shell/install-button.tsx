"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Registers the service worker and shows an "Install app" button where the browser supports
 * the install prompt (Chrome / Edge / Android). On iPhone Safari installation is via Share → Add to Home Screen.
 */
export function InstallButton({ label }: { label: string }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (!evt) return null;
  return (
    <button
      onClick={async () => { await evt.prompt(); await evt.userChoice.catch(() => null); setEvt(null); }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold-soft px-2.5 text-xs text-gold hover:bg-gold/20"
      title={label} aria-label={label}
    >
      <Download size={14} /> <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
