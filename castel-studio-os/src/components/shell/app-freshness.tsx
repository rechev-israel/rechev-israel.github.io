"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the installed app (Home Screen) current: when it comes back to the foreground it checks the deployed build —
 * a new version reloads the app; otherwise the data on screen is refreshed if the app was away for a while.
 */
export function AppFreshness({ build }: { build: string }) {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const d = (await r.json()) as { build?: string };
        if (d.build && build !== "dev" && d.build !== build) { location.reload(); return; }
      } catch { /* offline */ }
      if (hiddenAt.current && Date.now() - hiddenAt.current > 30_000) router.refresh();
      hiddenAt.current = null;
    };
    const onVis = () => { if (document.visibilityState === "hidden") hiddenAt.current = Date.now(); else check(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", check);
    const t = setInterval(check, 10 * 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pageshow", check); clearInterval(t); };
  }, [build, router]);
  return null;
}
