import type { Prisma, Role } from "@prisma/client";

/** Booking notifications contain customer details: only owners and managers see them. */
export const canSeeBookingNotifications = (role: Role) => role === "OWNER" || role === "MANAGER";

export function notificationWhere(user: { id: string; businessId: string; role: Role }, extra: Prisma.NotificationWhereInput = {}): Prisma.NotificationWhereInput {
  return {
    businessId: user.businessId,
    OR: [{ userId: null }, { userId: user.id }],
    ...(canSeeBookingNotifications(user.role) ? {} : { NOT: { kind: { startsWith: "booking" } } }),
    ...extra,
  };
}
