import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getI18n } from "@/i18n";
import { NAV } from "@/lib/nav";
import { db } from "@/lib/db";
import { Sidebar, type SidebarGroup } from "@/components/shell/sidebar";
import { PreferenceToggles } from "@/components/shell/preferences";
import { InstallButton } from "@/components/shell/install-button";
import { BrandMark } from "@/components/shell/brand";
import { logoutAction } from "@/server/actions/auth";

/** Modules shown in the phone tab bar, in priority order (first 4 the user can access). */
const PHONE_TABS = ["/dashboard", "/crm", "/bookings", "/academy", "/finance", "/agents", "/tasks"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const [pendingApprovals, unread, pendingMessages] = await Promise.all([
    can(user.role, "approvals.view") ? db.approvalRequest.count({ where: { businessId: user.businessId, status: "PENDING" } }) : 0,
    db.notification.count({ where: { businessId: user.businessId, readAt: null, OR: [{ userId: null }, { userId: user.id }] } }),
    can(user.role, "comms.view") ? db.outboundMessage.count({ where: { businessId: user.businessId, status: "PENDING_APPROVAL" } }) : 0,
  ]);

  const groups: SidebarGroup[] = NAV.map((g) => ({
    label: t.nav.groups[g.key],
    items: g.items
      .filter((i) => !i.permission || can(user.role, i.permission))
      .map((i) => ({
        href: i.href,
        label: t.nav[i.key as keyof typeof t.nav] as string,
        icon: i.icon as SidebarGroup["items"][number]["icon"],
        state: i.state,
        badge: i.key === "approvals" ? pendingApprovals : i.key === "communications" ? pendingMessages : undefined,
      })),
  })).filter((g) => g.items.length);
  const allowed = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));
  const primary = PHONE_TABS.filter((h) => allowed.has(h)).slice(0, 4);

  return (
    <div className="min-h-dvh safe-x">
      <Sidebar
        groups={groups}
        tagline={t.app.tagline}
        stateLabels={{ partial: locale === "he" ? "חלקי" : "Partial", planned: t.app.planned }}
        moreLabel={locale === "he" ? "עוד" : "More"}
        primary={primary}
      />
      <div className="md:ps-[76px] lg:ps-64">
        <header className="no-print safe-top sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
          <div className="flex min-h-14 items-center gap-2 px-4 md:min-h-16 md:px-8">
            <Link href="/dashboard" className="flex items-center gap-2 md:hidden" aria-label="CASTEL STUDIO">
              <BrandMark size={30} />
              <span className="font-display text-xs font-bold tracking-[0.2em] gold-text">CASTEL</span>
            </Link>
            <div className="ms-auto flex items-center gap-2">
              <InstallButton label={locale === "he" ? "התקנת האפליקציה" : "Install app"} />
              <Link href="/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-gold/40 hover:text-text" aria-label={locale === "he" ? `התראות (${unread})` : `Notifications (${unread})`}>
                <Bell size={15} />
                {unread > 0 && <span className="absolute -end-1 -top-1 min-w-4 rounded-full bg-gold px-1 text-center text-[9px] font-bold leading-4 text-black">{unread > 99 ? "99+" : unread}</span>}
              </Link>
              <PreferenceToggles locale={locale} t={t} />
              <div className="hidden text-end sm:block">
                <p className="text-sm font-medium leading-tight">{user.name}</p>
                <p className="text-[11px] text-muted">{t.roles[user.role]}</p>
              </div>
              <form action={logoutAction}>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:border-danger/40 hover:text-danger" title={t.common.logout} aria-label={t.common.logout}>
                  <LogOut size={14} /> <span className="hidden lg:inline">{t.common.logout}</span>
                </button>
              </form>
            </div>
          </div>
        </header>
        {/* pb clears the phone tab bar (4rem + safe area) */}
        <main className="mx-auto max-w-[1440px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:px-8 md:pb-10 md:pt-8 animate-in">{children}</main>
      </div>
    </div>
  );
}
