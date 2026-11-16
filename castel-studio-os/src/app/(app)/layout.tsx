import { LogOut } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getI18n } from "@/i18n";
import { NAV } from "@/lib/nav";
import { db } from "@/lib/db";
import { Sidebar, type SidebarGroup } from "@/components/shell/sidebar";
import { PreferenceToggles } from "@/components/shell/preferences";
import { logoutAction } from "@/server/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const pendingApprovals = can(user.role, "approvals.view") ? await db.approvalRequest.count({ where: { businessId: user.businessId, status: "PENDING" } }) : 0;

  const groups: SidebarGroup[] = NAV.map((g) => ({
    label: t.nav.groups[g.key],
    items: g.items
      .filter((i) => !i.permission || can(user.role, i.permission))
      .map((i) => ({
        href: i.href,
        label: t.nav[i.key as keyof typeof t.nav] as string,
        icon: i.icon as SidebarGroup["items"][number]["icon"],
        state: i.state,
        badge: i.key === "approvals" ? pendingApprovals : undefined,
      })),
  })).filter((g) => g.items.length);

  return (
    <div className="min-h-screen">
      <Sidebar groups={groups} tagline={t.app.tagline} stateLabels={{ partial: locale === "he" ? "חלקי" : "Partial", planned: t.app.planned }} />
      <div className="lg:ps-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur md:px-8">
          <PreferenceToggles locale={locale} t={t} />
          <div className="hidden text-end sm:block">
            <p className="text-sm font-medium leading-tight">{user.name}</p>
            <p className="text-[11px] text-muted">{t.roles[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:border-danger/40 hover:text-danger" title={t.common.logout}>
              <LogOut size={14} /> <span className="hidden md:inline">{t.common.logout}</span>
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 animate-in">{children}</main>
      </div>
    </div>
  );
}
