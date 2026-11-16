"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { formToObject, transactionSchema, type ActionState } from "@/lib/validation";
import { runAction } from "./util";

export async function createTransactionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("finance.edit");
    const input = transactionSchema.parse(formToObject(fd));
    const tx = await db.transaction.create({
      data: { businessId: user.businessId, ...input, occurredAt: new Date(input.occurredAt + "T12:00:00Z"), description: input.description ?? null, method: input.method ?? null },
    });
    await audit({ businessId: user.businessId, userId: user.id, action: "transaction.create", entityType: "Transaction", entityId: tx.id, metadata: { type: input.type, kind: input.kind, amount: input.amount } });
    revalidatePath("/finance");
  });
}

export async function deleteTransactionAction(fd: FormData) {
  const user = await requireUser("finance.edit");
  const id = String(fd.get("id"));
  // Transactions linked to academy payments are deleted only through the payment, to keep records consistent.
  const tx = await db.transaction.findFirst({ where: { id, businessId: user.businessId }, include: { payment: true } });
  if (!tx || tx.payment) return;
  await db.transaction.delete({ where: { id } });
  await audit({ businessId: user.businessId, userId: user.id, action: "transaction.delete", entityType: "Transaction", entityId: id, metadata: { amount: tx.amount.toString(), type: tx.type } });
  revalidatePath("/finance");
}
