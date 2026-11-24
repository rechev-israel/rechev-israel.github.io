import type { Permission } from "@/server/auth/rbac";

export type ModuleState = "live" | "partial" | "planned";
export type NavItem = { key: string; href: string; icon: string; state: ModuleState; permission?: Permission };
export type NavGroup = { key: "core" | "growth" | "ai" | "system"; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    key: "core",
    items: [
      { key: "dashboard", href: "/dashboard", icon: "LayoutDashboard", state: "live", permission: "dashboard.view" },
      { key: "crm", href: "/crm", icon: "Users", state: "live", permission: "crm.view" },
      { key: "bookings", href: "/bookings", icon: "CalendarDays", state: "live", permission: "bookings.view" },
      { key: "hours", href: "/hours", icon: "Clock", state: "live", permission: "bookings.view" },
      { key: "models", href: "/models", icon: "Sparkles", state: "live", permission: "bookings.view" },
      { key: "reviews", href: "/reviews", icon: "Star", state: "live", permission: "crm.view" },
      { key: "experience", href: "/experience", icon: "Crown", state: "live", permission: "crm.view" },
      { key: "academy", href: "/academy", icon: "GraduationCap", state: "live", permission: "academy.view" },
      { key: "finance", href: "/finance", icon: "Wallet", state: "live", permission: "finance.view" },
      { key: "tasks", href: "/tasks", icon: "ListChecks", state: "live" },
    ],
  },
  {
    key: "growth",
    items: [
      { key: "analytics", href: "/analytics", icon: "LineChart", state: "partial", permission: "dashboard.view" },
      { key: "marketing", href: "/marketing", icon: "Megaphone", state: "live", permission: "marketing.view" },
      { key: "creative", href: "/creative", icon: "Palette", state: "live", permission: "creative.view" },
      { key: "sites", href: "/sites", icon: "Globe", state: "live", permission: "marketing.view" },
      { key: "communications", href: "/communications", icon: "MessagesSquare", state: "live", permission: "comms.view" },
      { key: "automations", href: "/automations", icon: "Workflow", state: "live", permission: "automations.view" },
    ],
  },
  {
    key: "ai",
    items: [
      { key: "agents", href: "/agents", icon: "Bot", state: "live", permission: "ai.use" },
      { key: "twin", href: "/twin", icon: "UserRound", state: "live", permission: "marketing.view" },
      { key: "approvals", href: "/approvals", icon: "ShieldCheck", state: "live", permission: "approvals.view" },
    ],
  },
  {
    key: "system",
    items: [
      { key: "integrations", href: "/integrations", icon: "Plug", state: "live", permission: "integrations.view" },
      { key: "settings", href: "/settings", icon: "Settings", state: "live" },
      { key: "audit", href: "/audit", icon: "ScrollText", state: "live", permission: "audit.view" },
    ],
  },
];
