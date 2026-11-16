"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, CalendarDays, GraduationCap, Wallet, ListChecks, LineChart, Megaphone, Palette, Globe,
  MessagesSquare, Workflow, Bot, UserRound, ShieldCheck, Plug, Settings, ScrollText, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, Wordmark } from "./brand";

const ICONS = { LayoutDashboard, Users, CalendarDays, GraduationCap, Wallet, ListChecks, LineChart, Megaphone, Palette, Globe, MessagesSquare, Workflow, Bot, UserRound, ShieldCheck, Plug, Settings, ScrollText };

export type SidebarGroup = { label: string; items: { href: string; label: string; icon: keyof typeof ICONS; state: "live" | "partial" | "planned"; badge?: number }[] };

export function Sidebar({ groups, tagline, stateLabels }: { groups: SidebarGroup[]; tagline: string; stateLabels: { partial: string; planned: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const nav = (
    <nav className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5">
        <BrandMark />
        <Wordmark sub={tagline} />
      </Link>
      <div className="gold-rule mx-5 opacity-40" />
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/70">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = ICONS[it.icon];
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-gold-soft text-gold" : "text-muted hover:bg-surface-2 hover:text-text",
                      )}
                    >
                      <Icon size={17} className={cn(active ? "text-gold" : "text-muted group-hover:text-gold/80")} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.badge ? <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{it.badge}</span> : null}
                      {it.state !== "live" && (
                        <span className={cn("rounded px-1.5 py-px text-[9px] uppercase tracking-wide", it.state === "partial" ? "bg-info/15 text-info" : "bg-surface-3 text-muted")}>
                          {it.state === "partial" ? stateLabels.partial : stateLabels.planned}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print fixed start-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 rounded-lg border border-border bg-surface p-2.5 lg:hidden" aria-label="Menu">
        <Menu size={18} />
      </button>
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-border bg-surface lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="safe-top safe-bottom absolute inset-y-0 start-0 w-[min(18rem,85vw)] border-e border-border bg-surface animate-in">
            <button onClick={() => setOpen(false)} className="absolute end-2 top-[calc(env(safe-area-inset-top)+0.75rem)] p-2 text-muted" aria-label="Close"><X size={20} /></button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
