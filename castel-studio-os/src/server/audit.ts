import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function audit(params: {
  businessId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({ data: { ...params, userId: params.userId ?? null } });
  } catch (err) {
    // Audit failures must never break the user operation, but they must be visible in logs.
    console.error(JSON.stringify({ level: "error", msg: "audit.write_failed", action: params.action, err: String(err) }));
  }
}
