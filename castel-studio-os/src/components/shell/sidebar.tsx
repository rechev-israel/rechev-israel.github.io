"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, CalendarDays, GraduationCap, Wallet, ListChecks, LineChart, Megaphone, Palette, Globe,
  MessagesSquare, Workflow, Bot, UserRound, ShieldCheck, Plug, Settings, ScrollText, Menu, X, Clock, Star, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, Wordmark } from "./brand";

const ICONS = { LayoutDashboard, Users, CalendarDays, Clock, Star, Crown, GraduationCap, Wallet, ListChecks, LineChart, Megaphone, Palette, Globe, MessagesSquare, Workflow, Bot, UserRound, ShieldCheck, Plug, Settings, ScrollText };

export type SidebarItem = { href: string; label: string; icon: keyof typeof ICONS; state: "live" | "partial" | "planned"; badge?: number };
export type SidebarGroup = { label: string; items: SidebarItem[] };

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/**
 * Responsive navigation — one component, three layouts:
 *  • ≥1024px (desktop / tablet landscape): full sidebar with labels and module status.
 *  • 768–1023px (tablet portrait): compact icon rail with tooltips.
 *  • <768px (phone): bottom tab bar with the 4 most-used modules + "More" drawer containing everything.
 */
export function Sidebar({ groups, tagline, stateLabels, moreLabel, primary }: {
  groups: SidebarGroup[];
  tagline: string;
  stateLabels: { partial: string; planned: string };
  moreLabel: string;
  /** hrefs shown in the phone tab bar (already permission-filtered) */
  primary: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const all = groups.flatMap((g) => g.items);
  const tabs = primary.map((h) => all.find((i) => i.href === h)).filter(Boolean) as SidebarItem[];
  const moreActive = !tabs.some((t) => isActive(pathname, t.href));

  const fullNav = (
    <nav className="flex h-full flex-col" aria-label="Main">
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5">
        <BrandMark />
        <Wordmark sub={tagline} />
      </Link>
      <div className="gold-rule mx-5 opacity-40" />
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 py-5">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/70">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = ICONS[it.icon];
                const active = isActive(pathname, it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors lg:min-h-0",
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
      {/* Desktop / tablet-landscape sidebar */}
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-border bg-surface lg:block">{fullNav}</aside>

      {/* Tablet-portrait icon rail */}
      <aside className="no-print safe-top fixed inset-y-0 start-0 z-30 hidden w-[76px] flex-col items-center border-e border-border bg-surface md:flex lg:hidden" aria-label="Main">
        <Link href="/dashboard" className="py-4" aria-label="CASTEL STUDIO"><BrandMark size={38} /></Link>
        <div className="gold-rule w-10 opacity-40" />
        <ul className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain py-3">
          {groups.map((g, gi) => (
            <li key={g.label} className="contents">
              {gi > 0 && <span className="my-1.5 h-px w-8 bg-border" aria-hidden="true" />}
              {g.items.map((it) => {
                const Icon = ICONS[it.icon];
                const active = isActive(pathname, it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={it.label}
                    aria-label={it.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                      active ? "bg-gold-soft text-gold" : "text-muted hover:bg-surface-2 hover:text-text",
                      it.state === "planned" && !active && "opacity-60",
                    )}
                  >
                    <Icon size={19} />
                    {it.badge ? <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-gold px-1 text-center text-[9px] font-bold leading-4 text-black">{it.badge}</span> : null}
                  </Link>
                );
              })}
            </li>
          ))}
        </ul>
      </aside>

      {/* Phone bottom tab bar */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden" aria-label="Main">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {tabs.map((it) => {
            const Icon = ICONS[it.icon];
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href} className="flex-1">
                <Link href={it.href} aria-current={active ? "page" : undefined}
                  className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-gold" : "text-muted")}>
                  <span className="relative">
                    <Icon size={21} />
                    {it.badge ? <span className="absolute -end-2 -top-1 min-w-4 rounded-full bg-gold px-1 text-center text-[9px] font-bold leading-4 text-black">{it.badge}</span> : null}
                  </span>
                  <span className="max-w-full truncate px-1">{it.label.replace(/\s*\(.*\)/, "")}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button onClick={() => setOpen(true)} aria-expanded={open}
              className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px]", moreActive ? "text-gold" : "text-muted")}>
              <span className="relative">
                <Menu size={21} />
                {all.some((i) => i.badge && !tabs.includes(i)) && <span className="absolute -end-1 -top-0.5 h-2 w-2 rounded-full bg-gold" />}
              </span>
              <span>{moreLabel}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Drawer (phones; full navigation) */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="safe-top safe-bottom absolute inset-y-0 start-0 w-[min(19rem,86vw)] border-e border-border bg-surface animate-in">
            <button onClick={() => setOpen(false)} className="absolute end-2 top-[calc(env(safe-area-inset-top)+0.75rem)] p-2 text-muted" aria-label="Close"><X size={20} /></button>
            {fullNav}
          </aside>
        </div>
      )}
    </>
  );
}
