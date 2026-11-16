"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";

/**
 * Approve or reject a queued external action. In Phase 1 no executors are configured, so an approval
 * records the decision only; the action is NOT performed automatically (it stays APPROVED for manual handling).
 */
export async function decideApprovalAction(fd: FormData) {
  const user = await requireUser("approvals.decide");
  const id = String(fd.get("id"));
  const decision = fd.get("decision") === "approve" ? "APPROVED" : "REJECTED";
  const note = String(fd.get("note") ?? "").slice(0, 500) || null;
  const r = await db.approvalRequest.updateMany({
    where: { id, businessId: user.businessId, status: "PENDING" },
    data: { status: decision, decidedById: user.id, decidedAt: new Date(), decisionNote: note },
  });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: `approval.${decision.toLowerCase()}`, entityType: "ApprovalRequest", entityId: id });
  revalidatePath("/approvals");
}
