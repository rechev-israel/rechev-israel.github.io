"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { saveExperience } from "@/server/services/experience";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

const on = (fd: FormData, k: string) => fd.get(k) === "on";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const done = () => { revalidatePath("/experience"); revalidatePath("/crm/[id]", "page"); };

/** Owner-only: turn programs on/off and define rewards in their own words. */
export async function saveExperienceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("services.edit");
    const section = str(fd, "section") as "club" | "vip" | "referral" | "reminders";
    const value =
      section === "club" ? { enabled: on(fd, "enabled"), visitsRequired: str(fd, "visitsRequired"), rewardType: str(fd, "rewardType"), rewardValue: str(fd, "rewardValue"), rewardLabel: str(fd, "rewardLabel"), premiumQualifies: on(fd, "premiumQualifies"), expiryDays: str(fd, "expiryDays"), conditions: str(fd, "conditions") }
      : section === "vip" ? { enabled: on(fd, "enabled"), autoEnabled: on(fd, "autoEnabled"), autoMinVisits: str(fd, "autoMinVisits"), benefits: str(fd, "benefits").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8), announcement: str(fd, "announcement"), waitlistPriority: on(fd, "waitlistPriority") }
      : section === "referral" ? { enabled: on(fd, "enabled"), referrerRewardLabel: str(fd, "referrerRewardLabel"), friendRewardLabel: str(fd, "friendRewardLabel"), bothBenefit: on(fd, "bothBenefit"), minCompleted: str(fd, "minCompleted"), maxPerCustomer: str(fd, "maxPerCustomer"), expiryDays: str(fd, "expiryDays"), conditions: str(fd, "conditions") }
      : section === "reminders" ? { enabled: on(fd, "enabled"), h24: on(fd, "h24"), h2: on(fd, "h2") }
      : null;
    if (!value) return { error: "bad section" };
    await saveExperience(user.businessId, section, value);
    await audit({ businessId: user.businessId, userId: user.id, action: `experience.${section}.saved`, entityType: "ExperienceSettings", metadata: value });
    done();
  });
}

/** Mark a reward as given at the shop (or cancel it). */
export async function setRewardStatusAction(fd: FormData) {
  const user = await requireUser("crm.edit");
  const status = str(fd, "status");
  if (!["REDEEMED", "VOID", "AVAILABLE"].includes(status)) return;
  const id = str(fd, "id");
  const r = await db.loyaltyReward.updateMany({ where: { id, businessId: user.businessId }, data: { status, redeemedAt: status === "REDEEMED" ? new Date() : null, redeemedById: status === "REDEEMED" ? user.id : null } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: `reward.${status.toLowerCase()}`, entityType: "LoyaltyReward", entityId: id });
  done();
}

/** Grant or revoke CASTEL VIP for one customer. */
export async function setVipAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const customerId = str(fd, "customerId");
  const c = await db.customer.findFirst({ where: { id: customerId, businessId: user.businessId }, select: { id: true } });
  if (!c) return;
  const active = fd.get("on") === "1";
  await db.vipMembership.upsert({
    where: { customerId }, create: { businessId: user.businessId, customerId, status: active ? "ACTIVE" : "REVOKED", source: "MANUAL" },
    update: { status: active ? "ACTIVE" : "REVOKED", source: "MANUAL", ...(active ? { since: new Date() } : {}) },
  });
  await audit({ businessId: user.businessId, userId: user.id, action: active ? "vip.granted" : "vip.revoked", entityType: "Customer", entityId: customerId });
  done();
}

/** Remove a waitlist request (e.g. after arranging it by phone). */
export async function closeWaitlistAction(fd: FormData) {
  const user = await requireUser("crm.edit");
  const id = str(fd, "id");
  const r = await db.waitlistEntry.updateMany({ where: { id, businessId: user.businessId, status: { in: ["ACTIVE", "NOTIFIED"] } }, data: { status: str(fd, "status") === "BOOKED" ? "BOOKED" : "LEFT" } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "waitlist.closed_by_staff", entityType: "WaitlistEntry", entityId: id });
  done();
}

/** Reject a referral that looks wrong (e.g. the same person under two numbers). */
export async function rejectReferralAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const id = str(fd, "id");
  const r = await db.referral.updateMany({ where: { id, businessId: user.businessId, status: "PENDING" }, data: { status: "REJECTED", reason: "owner" } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "referral.rejected", entityType: "Referral", entityId: id });
  done();
}
