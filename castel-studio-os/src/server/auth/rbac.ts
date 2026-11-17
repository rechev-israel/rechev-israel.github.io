import type { Role } from "@prisma/client";

/**
 * Permission map. Server code must call `can()` / `requirePermission()` —
 * UI hiding is a convenience only, never the enforcement point.
 */
export const PERMISSIONS = {
  "dashboard.view": ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"],
  "crm.view": ["OWNER", "MANAGER", "BARBER", "MARKETING", "VIEWER"],
  "crm.edit": ["OWNER", "MANAGER", "BARBER"],
  "crm.delete": ["OWNER", "MANAGER"],
  "crm.export": ["OWNER", "MANAGER"],
  "bookings.view": ["OWNER", "MANAGER", "BARBER", "VIEWER"],
  "bookings.edit": ["OWNER", "MANAGER", "BARBER"],
  "services.edit": ["OWNER", "MANAGER"],
  "academy.view": ["OWNER", "MANAGER", "INSTRUCTOR", "VIEWER"],
  "academy.edit": ["OWNER", "MANAGER", "INSTRUCTOR"],
  "academy.payments": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "finance.view": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "finance.edit": ["OWNER", "ACCOUNTANT"],
  "ai.use": ["OWNER", "MANAGER", "MARKETING"],
  "ai.financeData": ["OWNER", "ACCOUNTANT"],
  "approvals.decide": ["OWNER"],
  "approvals.view": ["OWNER", "MANAGER", "MARKETING"],
  "integrations.view": ["OWNER", "MANAGER"],
  "settings.users": ["OWNER"],
  "settings.business": ["OWNER", "MANAGER"],
  "audit.view": ["OWNER"],
  "tasks.edit": ["OWNER", "MANAGER", "BARBER", "INSTRUCTOR", "MARKETING", "ACCOUNTANT"],
  "marketing.edit": ["OWNER", "MANAGER", "MARKETING"],
  "marketing.view": ["OWNER", "MANAGER", "MARKETING", "VIEWER"],
  "automations.view": ["OWNER", "MANAGER"],
  "automations.edit": ["OWNER", "MANAGER"],
  "comms.view": ["OWNER", "MANAGER", "MARKETING"],
  "comms.draft": ["OWNER", "MANAGER", "MARKETING", "BARBER"],
  "comms.approve": ["OWNER"],
  "creative.view": ["OWNER", "MANAGER", "MARKETING"],
  "creative.edit": ["OWNER", "MANAGER", "MARKETING"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`Forbidden: ${permission}`);
  }
}
