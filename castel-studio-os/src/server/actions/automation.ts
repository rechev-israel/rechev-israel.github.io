"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { definitionSchema, TRIGGER_KEYS } from "@/server/automation/definition";
import { ensureBuiltinAutomations } from "@/server/automation/defaults";
import { isScheduleTrigger, processRetries, runScheduled } from "@/server/automation/engine";
import { flushDueMessages } from "@/server/comms/messages";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

export async function toggleAutomationAction(fd: FormData) {
  const user = await requireUser("automations.edit");
  const id = String(fd.get("id"));
  const a = await db.automation.findFirst({ where: { id, businessId: user.businessId } });
  if (!a) return;
  await db.automation.update({ where: { id }, data: { isActive: !a.isActive } });
  await audit({ businessId: user.businessId, userId: user.id, action: a.isActive ? "automation.deactivate" : "automation.activate", entityType: "Automation", entityId: id });
  revalidatePath("/automations");
}

/** Owner-triggered run of a scheduled workflow (same logic as the daily cron, scoped to this business). */
export async function runAutomationNowAction(fd: FormData) {
  const user = await requireUser("automations.edit");
  const id = String(fd.get("id"));
  const a = await db.automation.findFirst({ where: { id, businessId: user.businessId } });
  if (!a || !isScheduleTrigger(a.trigger)) return;
  if (!a.isActive) await db.automation.update({ where: { id }, data: { isActive: true } });
  const summary = await runScheduled(new Date(), { businessId: user.businessId, automationId: id });
  if (!a.isActive) await db.automation.update({ where: { id }, data: { isActive: false } });
  await audit({ businessId: user.businessId, userId: user.id, action: "automation.run_now", entityType: "Automation", entityId: id, metadata: summary });
  revalidatePath("/automations");
}

export async function runMaintenanceAction() {
  const user = await requireUser("automations.edit");
  await ensureBuiltinAutomations(db, user.businessId);
  await processRetries();
  await flushDueMessages();
  revalidatePath("/automations");
}

const saveSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  trigger: z.enum(TRIGGER_KEYS as [string, ...string[]]),
  maxRetries: z.coerce.number().int().min(1).max(5).default(3),
  definition: z.string().max(20_000),
});

export async function saveAutomationAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("automations.edit");
    const input = saveSchema.parse({ name: fd.get("name"), description: fd.get("description") || undefined, trigger: fd.get("trigger"), maxRetries: fd.get("maxRetries") || 3, definition: fd.get("definition") });
    let raw: unknown;
    try { raw = JSON.parse(input.definition); } catch { return { error: "JSON", fieldErrors: { definition: "invalid JSON" } }; }
    const definition = definitionSchema.parse(raw);
    const data = { name: input.name, description: input.description ?? null, trigger: input.trigger, maxRetries: input.maxRetries, definition };
    if (id) {
      const r = await db.automation.updateMany({ where: { id, businessId: user.businessId }, data });
      if (!r.count) throw new Error("not found");
    } else {
      await db.automation.create({ data: { ...data, businessId: user.businessId, isActive: false } });
    }
    await audit({ businessId: user.businessId, userId: user.id, action: id ? "automation.update" : "automation.create", entityType: "Automation", entityId: id });
    revalidatePath("/automations");
  });
}

export async function deleteAutomationAction(fd: FormData) {
  const user = await requireUser("automations.edit");
  const id = String(fd.get("id"));
  // Built-in workflows can be deactivated but not deleted (they would be re-installed).
  const r = await db.automation.deleteMany({ where: { id, businessId: user.businessId, key: null } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "automation.delete", entityType: "Automation", entityId: id });
  revalidatePath("/automations");
}
