"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

type Latest = { id: string; title: string; body: string | null; createdAt: string; kind: string } | null;

/** Header bell with a live unread counter (polls every 20s and when the app comes back to the foreground) and a toast for new items. */
export function LiveBell({ initial, he }: { initial: number; he: boolean }) {
  const label = (n: number) => (he ? `התראות (${n})` : `Notifications (${n})`);
  const [unread, setUnread] = useState(initial);
  const [toast, setToast] = useState<Latest>(null);
  const seen = useRef<string | null>(null);
  const first = useRef(true);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/notifications/summary", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { unread: number; latest: Latest };
        if (!alive) return;
        setUnread((prev) => {
          if (!first.current && d.latest && d.latest.id !== seen.current && d.unread > prev) {
            setToast(d.latest);
            if (path.startsWith("/bookings") || path.startsWith("/notifications") || path.startsWith("/dashboard")) router.refresh();
          }
          return d.unread;
        });
        seen.current = d.latest?.id ?? seen.current;
        first.current = false;
      } catch { /* offline: try again next tick */ }
    };
    tick();
    const t = setInterval(tick, 20_000);
    const vis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [path, router]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 12_000); return () => clearTimeout(t); }, [toast]);

  return (
    <>
      <Link href="/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-gold/40 hover:text-text" aria-label={label(unread)}>
        <Bell size={15} />
        {unread > 0 && <span className="absolute -end-1 -top-1 min-w-4 rounded-full bg-gold px-1 text-center text-[9px] font-bold leading-4 text-black" aria-live="polite">{unread > 99 ? "99+" : unread}</span>}
      </Link>
      {toast && (
        <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-50 mx-auto max-w-md animate-in rounded-2xl border border-gold/50 bg-surface/95 p-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:end-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><Bell size={15} /></span>
            <a href={`/api/notifications/${toast.id}/open`} className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-muted">{toast.body}</p>}
            </a>
            <button type="button" onClick={() => setToast(null)} className="text-muted hover:text-text" aria-label="close"><X size={14} /></button>
          </div>
        </div>
      )}
    </>
  );
}
