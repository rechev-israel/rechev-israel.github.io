"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";

const STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;

/** Publish / hide a review (only published reviews appear on the website). */
export async function setReviewStatusAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const status = String(fd.get("status") ?? "") as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) return;
  const id = String(fd.get("id") ?? "");
  const r = await db.review.updateMany({ where: { id, businessId: user.businessId }, data: { status } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: `review.${status.toLowerCase()}`, entityType: "Review", entityId: id });
  revalidatePath("/reviews");
}

export async function deleteReviewAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const id = String(fd.get("id") ?? "");
  const r = await db.review.deleteMany({ where: { id, businessId: user.businessId } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "review.deleted", entityType: "Review", entityId: id });
  revalidatePath("/reviews");
}
