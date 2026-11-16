import "server-only";
import { requireUser } from "./session";
import { can, type Permission } from "./rbac";
import { getI18n } from "@/i18n";

/** For pages: returns the user + i18n, and `allowed=false` instead of throwing so the page can render a Forbidden state. */
export async function pageGuard(permission?: Permission) {
  const user = await requireUser();
  const i18n = await getI18n();
  return { user, ...i18n, allowed: !permission || can(user.role, permission) };
}
