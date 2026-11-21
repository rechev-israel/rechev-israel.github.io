"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/lib/db";
import { markGiftPaid, redeemGift, setLiveStatus } from "@/server/services/client-features";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

/** "Delay 10/15/30 min" / "Come in now" / clear — the only way a live status appears for the customer. */
export async function setLiveStatusAction(fd: FormData) {
  const user = await requireUser("bookings.edit");
  const status = String(fd.get("status") ?? "");
  if (!["delay", "ready", "clear"].includes(status)) return;
  const id = String(fd.get("id") ?? "");
  if (await setLiveStatus(user, id, status as "delay" | "ready" | "clear", Number(fd.get("delay") ?? 10))) {
    await audit({ businessId: user.businessId, userId: user.id, action: `appointment.live_${status}`, entityType: "Appointment", entityId: id });
  }
  revalidatePath("/bookings");
}

export async function markGiftPaidAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const id = String(fd.get("id") ?? "");
  if (await markGiftPaid(user, id)) await audit({ businessId: user.businessId, userId: user.id, action: "gift.paid", entityType: "GiftCard", entityId: id });
  revalidatePath("/experience");
}

export async function cancelGiftAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const id = String(fd.get("id") ?? "");
  const r = await db.giftCard.updateMany({ where: { id, businessId: user.businessId, status: { in: ["REQUESTED", "ACTIVE"] } }, data: { status: "CANCELLED" } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "gift.cancelled", entityType: "GiftCard", entityId: id });
  revalidatePath("/experience");
}

/** Redeem by code (typed at the counter) or from the list. Works once. */
export async function redeemGiftAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("crm.edit");
    const r = await redeemGift(user, String(fd.get("code") ?? fd.get("id") ?? ""));
    if (!r.ok) return { error: ({ not_found: "קוד לא נמצא / Code not found", already: "הכרטיס כבר מומש / Already redeemed", unpaid: "הכרטיס עוד לא סומן כשולם / Not paid yet", expired: "פג תוקף / Expired", inactive: "הכרטיס לא פעיל / Inactive" } as Record<string, string>)[r.error] };
    await audit({ businessId: user.businessId, userId: user.id, action: "gift.redeemed", entityType: "GiftCard", entityId: r.gift.id });
    revalidatePath("/experience");
    return { ok: true, message: `מומש ✓ ${r.gift.serviceName ?? `₪${r.gift.amount}`} · ${r.gift.recipientName}` };
  });
}
