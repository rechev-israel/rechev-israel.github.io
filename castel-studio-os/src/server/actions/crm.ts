"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { customerSchema, formToObject, interactionSchema, noteSchema, type ActionState } from "@/lib/validation";
import { archiveCustomer, createCustomer, recomputeCustomerStats, updateCustomer } from "@/server/services/crm";
import { canMarketTo, upcomingBirthday } from "@/domain/crm";
import { runAction } from "./util";

export async function createCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async () => {
    const user = await requireUser("crm.edit");
    const c = await createCustomer(user, customerSchema.parse(formToObject(fd)));
    id = c.id;
  });
  if (id) redirect(`/crm/${id}`);
  return res;
}

export async function updateCustomerAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("crm.edit");
    await updateCustomer(user, id, customerSchema.parse(formToObject(fd)));
    revalidatePath(`/crm/${id}`);
  });
}

export async function archiveCustomerAction(fd: FormData) {
  const user = await requireUser("crm.delete");
  await archiveCustomer(user, String(fd.get("id")));
  revalidatePath("/crm");
  redirect("/crm");
}

export async function addNoteAction(customerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("crm.edit");
    const input = noteSchema.parse({ body: fd.get("body"), pinned: fd.get("pinned") === "on" });
    const c = await db.customer.findFirst({ where: { id: customerId, businessId: user.businessId } });
    if (!c) throw new Error("not found");
    await db.customerNote.create({ data: { customerId, authorId: user.id, body: input.body, pinned: Boolean(input.pinned) } });
    revalidatePath(`/crm/${customerId}`);
  });
}

export async function deleteNoteAction(fd: FormData) {
  const user = await requireUser("crm.edit");
  const id = String(fd.get("id"));
  const note = await db.customerNote.findFirst({ where: { id, customer: { businessId: user.businessId } } });
  if (!note) return;
  await db.customerNote.delete({ where: { id } });
  revalidatePath(`/crm/${note.customerId}`);
}

export async function logInteractionAction(customerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("crm.edit");
    const input = interactionSchema.parse(formToObject(fd));
    const c = await db.customer.findFirst({ where: { id: customerId, businessId: user.businessId } });
    if (!c) throw new Error("not found");
    await db.interaction.create({ data: { customerId, ...input } });
    await audit({ businessId: user.businessId, userId: user.id, action: "interaction.log", entityType: "Customer", entityId: customerId });
    revalidatePath(`/crm/${customerId}`);
  });
}

export async function recomputeSegmentsAction() {
  const user = await requireUser("crm.edit");
  const n = await recomputeCustomerStats(user.businessId);
  await audit({ businessId: user.businessId, userId: user.id, action: "crm.recompute", entityType: "Customer", metadata: { changed: n } });
  revalidatePath("/crm");
}

export async function createFollowUpTaskAction(fd: FormData) {
  const user = await requireUser("tasks.edit");
  const customerId = String(fd.get("customerId"));
  const c = await db.customer.findFirst({ where: { id: customerId, businessId: user.businessId } });
  if (!c) return;
  await db.task.create({
    data: {
      businessId: user.businessId,
      title: `Follow-up: ${c.firstName} ${c.lastName ?? ""}`.trim(),
      details: `/crm/${c.id}`,
      dueAt: new Date(Date.now() + 2 * 86400_000),
      assigneeId: user.id,
    },
  });
  revalidatePath("/tasks");
  revalidatePath(`/crm/${customerId}`);
}

/**
 * Birthday campaign: builds a message draft for opted-in customers only and queues it as an approval request.
 * Nothing is sent from here.
 */
export async function draftBirthdayCampaignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("crm.edit");
    const channel = fd.get("channel") === "SMS" ? "SMS" : fd.get("channel") === "EMAIL" ? "EMAIL" : "WHATSAPP";
    const body = String(fd.get("body") ?? "").trim().slice(0, 1000);
    if (!body) return { error: "—", fieldErrors: { body: "required" } };
    const customers = await db.customer.findMany({ where: { businessId: user.businessId, archivedAt: null, birthday: { not: null } } });
    const recipients = customers.filter((c) => upcomingBirthday(c.birthday, new Date(), 14) !== null && canMarketTo(c, channel));
    const req = await db.approvalRequest.create({
      data: {
        businessId: user.businessId,
        kind: "message.send",
        title: `Birthday campaign (${channel}) — ${recipients.length} recipients`,
        payload: { channel, body, recipientIds: recipients.map((r) => r.id) },
        requestedById: user.id,
      },
    });
    await audit({ businessId: user.businessId, userId: user.id, action: "approval.create", entityType: "ApprovalRequest", entityId: req.id, metadata: { kind: "message.send", recipients: recipients.length } });
    revalidatePath("/approvals");
    return { ok: true, message: `✓ ${recipients.length} → /approvals` };
  });
}
