"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { hashPassword, passwordPolicyError } from "@/server/auth/password";
import { formToObject, taskSchema, userSchema, type ActionState } from "@/lib/validation";
import { getI18n } from "@/i18n";
import { lookup, runAction } from "./util";

export async function createTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("tasks.edit");
    const input = taskSchema.parse(formToObject(fd));
    if (input.assigneeId && !(await db.user.findFirst({ where: { id: input.assigneeId, businessId: user.businessId } }))) throw new Error("bad assignee");
    await db.task.create({ data: { businessId: user.businessId, title: input.title, details: input.details ?? null, priority: input.priority, dueAt: input.dueAt ? new Date(input.dueAt + "T12:00:00Z") : null, assigneeId: input.assigneeId ?? null } });
    revalidatePath("/tasks");
  });
}

export async function setTaskStatusAction(fd: FormData) {
  const user = await requireUser("tasks.edit");
  const status = z.enum(["OPEN", "IN_PROGRESS", "DONE"]).parse(fd.get("status"));
  await db.task.updateMany({ where: { id: String(fd.get("id")), businessId: user.businessId }, data: { status } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function updateBusinessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("settings.business");
    const input = z.object({ name: z.string().trim().min(1).max(100), city: z.string().trim().min(1).max(100), instagram: z.string().trim().url().max(300).or(z.literal("")) }).parse(formToObject(fd));
    await db.business.update({ where: { id: user.businessId }, data: { ...input, instagram: input.instagram || null } });
    await audit({ businessId: user.businessId, userId: user.id, action: "business.update", entityType: "Business", entityId: user.businessId });
    revalidatePath("/settings");
  });
}

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const me = await requireUser("settings.users");
    const { t } = await getI18n();
    const input = userSchema.parse(formToObject(fd));
    const policy = passwordPolicyError(input.password);
    if (policy) return { error: lookup(t, policy), fieldErrors: { password: lookup(t, policy) ?? "" } };
    try {
      const u = await db.user.create({ data: { businessId: me.businessId, name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) } });
      await audit({ businessId: me.businessId, userId: me.id, action: "user.create", entityType: "User", entityId: u.id, metadata: { role: input.role } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: t.errors.validation, fieldErrors: { email: "✕" } };
      throw e;
    }
    revalidatePath("/settings");
  });
}

export async function updateUserAction(fd: FormData) {
  const me = await requireUser("settings.users");
  const id = String(fd.get("id"));
  const target = await db.user.findFirst({ where: { id, businessId: me.businessId } });
  if (!target) return;
  const data: Prisma.UserUpdateInput = {};
  const role = fd.get("role");
  if (role) data.role = z.enum(["OWNER", "MANAGER", "BARBER", "INSTRUCTOR", "MARKETING", "ACCOUNTANT", "VIEWER"]).parse(role);
  if (fd.get("toggleActive")) {
    if (id === me.id) return; // cannot deactivate self
    data.isActive = !target.isActive;
  }
  if (id === me.id && data.role && data.role !== "OWNER") {
    // never allow the last owner to demote themselves
    const owners = await db.user.count({ where: { businessId: me.businessId, role: "OWNER", isActive: true } });
    if (owners <= 1) return;
  }
  await db.user.update({ where: { id }, data });
  if (data.isActive === false) await db.session.deleteMany({ where: { userId: id } });
  await audit({ businessId: me.businessId, userId: me.id, action: "user.update", entityType: "User", entityId: id, metadata: { role: data.role ?? null, isActive: data.isActive ?? null } });
  revalidatePath("/settings");
}
