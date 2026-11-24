"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/lib/db";
import { parseLocalDateTime } from "@/lib/dates";
import { saveExperience } from "@/server/services/experience";
import { ModelError, approveModel, deleteModelPhotos, rejectModel } from "@/server/services/model-applications";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

const MSG: Record<string, string> = {
  forbidden: "רק בעל העסק יכול לאשר בקשת מודליסט.", not_pending: "הבקשה כבר טופלה.", day_taken: "כבר יש מודליסט ביום הזה.",
  conflict: "השעות האלה כבר תפוסות ביומן. אפשר לדחות ולהציע מועד חלופי.", past: "המועד כבר עבר.", not_found: "הבקשה לא נמצאה.", busy: "נסו שוב.",
};
const done = () => { revalidatePath("/models"); revalidatePath("/bookings"); };

export async function approveModelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("bookings.edit");
    try { await approveModel(user, String(fd.get("id") ?? "")); } catch (e) { if (e instanceof ModelError) return { error: MSG[e.message] ?? e.message }; throw e; }
    done();
    return { ok: true, message: "הבקשה אושרה ✓ נוצר תור של שעתיים ביומן." };
  });
}

export async function rejectModelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("bookings.edit");
    const alt = String(fd.get("alt") ?? "");
    try { await rejectModel(user, String(fd.get("id") ?? ""), { reason: String(fd.get("reason") ?? ""), altStartsAt: alt ? parseLocalDateTime(alt) : null }); }
    catch (e) { if (e instanceof ModelError) return { error: MSG[e.message] ?? e.message }; throw e; }
    done();
    return { ok: true, message: alt ? "נשלחה הצעה למועד חלופי." : "הבקשה נדחתה, והזמן ביומן שוחרר." };
  });
}

export async function deleteModelPhotosAction(fd: FormData) {
  const user = await requireUser("services.edit");
  const id = String(fd.get("id") ?? "");
  const a = await db.modelApplication.findFirst({ where: { id, businessId: user.businessId }, select: { id: true } });
  if (!a) return;
  await deleteModelPhotos(a.id);
  await audit({ businessId: user.businessId, userId: user.id, action: "model.photos_deleted", entityType: "ModelApplication", entityId: id });
  done();
}

export async function saveModelSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("services.edit");
    const dates = String(fd.get("disabledDates") ?? "").split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
    const v = await saveExperience(user.businessId, "model", { enabled: fd.get("enabled") === "on", holdHours: fd.get("holdHours"), releaseOnReject: fd.get("releaseOnReject") === "on", photoRetentionDays: fd.get("photoRetentionDays"), disabledDates: [...new Set(dates)].sort() });
    if ((v as { enabled: boolean }).enabled) { const { ensureModelService } = await import("@/server/services/model-applications"); await ensureModelService(user.businessId); }
    await audit({ businessId: user.businessId, userId: user.id, action: "experience.model.saved", entityType: "ExperienceSettings", metadata: v });
    done();
  });
}
