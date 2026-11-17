"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { createGenerationJob, refreshCreativeJobs } from "@/server/creative/service";
import { generateWithAgent } from "@/server/ai/orchestrator";
import { getI18n } from "@/i18n";
import { formToObject, type ActionState } from "@/lib/validation";
import { runAction } from "./util";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const opt = (max: number) => z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().max(max).optional());

export async function saveBrandKitAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("creative.edit");
    const i = z.object({
      displayName: z.string().trim().min(1).max(60), tagline: opt(120), primaryColor: hex, accentColor: hex, textColor: hex,
      voiceTone: opt(500), visualStyle: opt(500), handle: opt(60),
      hashtags: z.preprocess((v) => (typeof v === "string" ? v.split(/[\s,]+/).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)) : []), z.array(z.string().max(60)).max(30)),
    }).parse(formToObject(fd));
    const data = { ...i, tagline: i.tagline ?? null, voiceTone: i.voiceTone ?? null, visualStyle: i.visualStyle ?? null, handle: i.handle ?? null };
    await db.brandKit.upsert({ where: { businessId: user.businessId }, create: { businessId: user.businessId, ...data }, update: data });
    await audit({ businessId: user.businessId, userId: user.id, action: "brandkit.save", entityType: "BrandKit" });
    revalidatePath("/creative");
  });
}

const KINDS = ["image", "image_edit", "video", "animation", "model3d", "voiceover"] as const;

export async function createCreativeJobAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState> => {
    const user = await requireUser("creative.edit");
    const { locale } = await getI18n();
    const i = z.object({
      kind: z.enum(KINDS),
      title: z.string().trim().min(1).max(120),
      prompt: z.string().trim().min(3).max(4000),
      imageUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().max(2000).refine((u) => /^https:\/\//.test(u), "https only").optional()),
      extraInput: opt(4000),
    }).parse(formToObject(fd));
    let extra: Record<string, unknown> | undefined;
    if (i.extraInput) {
      try { const v = JSON.parse(i.extraInput); if (v && typeof v === "object" && !Array.isArray(v)) extra = v; else throw new Error(); }
      catch { return { error: "JSON", fieldErrors: { extraInput: "invalid JSON object" } }; }
    }
    if ((i.kind === "image_edit" || i.kind === "animation") && !i.imageUrl) return { error: "—", fieldErrors: { imageUrl: locale === "he" ? "נדרש קישור לתמונת מקור" : "Source image URL required" } };
    const a = await createGenerationJob(user, { kind: i.kind, title: i.title, prompt: i.prompt, imageUrl: i.imageUrl, extraInput: extra });
    revalidatePath("/creative");
    const L = (he: string, en: string) => (locale === "he" ? he : en);
    if (a.status === "pending_config") return { ok: true, message: L("נשמר כממתין להגדרת ספק — לא בוצעה יצירה. הגדירו את משתני הסביבה של הספק ונסו שוב.", "Saved as pending provider configuration — nothing was generated. Configure the provider env vars and retry.") };
    if (a.status === "failed") return { error: `${L("הספק החזיר שגיאה", "Provider error")}: ${a.error}` };
    return { ok: true, message: a.status === "succeeded" ? L("✓ נוצר בהצלחה", "✓ Generated") : L("✓ נשלח לעיבוד — רעננו בעוד מספר שניות/דקות", "✓ Processing — refresh in a few seconds/minutes") };
  });
}

export async function retryCreativeJobAction(fd: FormData) {
  const user = await requireUser("creative.edit");
  const a = await db.creativeAsset.findFirst({ where: { id: String(fd.get("id")), businessId: user.businessId, status: { in: ["pending_config", "failed"] } } });
  if (!a || !a.prompt) return;
  const meta = (a.meta ?? {}) as { imageUrl?: string | null; extraInput?: Record<string, unknown> | null };
  await db.creativeAsset.update({ where: { id: a.id }, data: { status: "cancelled_retry" } });
  await createGenerationJob(user, { kind: a.kind as (typeof KINDS)[number], title: a.title, prompt: a.prompt, imageUrl: meta.imageUrl ?? null, extraInput: meta.extraInput ?? undefined });
  await db.creativeAsset.delete({ where: { id: a.id } });
  revalidatePath("/creative");
}

export async function refreshCreativeAction() {
  const user = await requireUser("creative.view");
  await refreshCreativeJobs(user.businessId);
  revalidatePath("/creative");
}

/** Built-in graphic from the canvas designer. Accepts only PNG/JPEG data URLs up to ~2.5 MB. */
export async function saveGraphicAction(input: { title: string; dataUrl: string; template: string; size: string }): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("creative.edit");
    const i = z.object({
      title: z.string().trim().min(1).max(120),
      dataUrl: z.string().max(3_500_000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/),
      template: z.string().max(40),
      size: z.enum(["post", "story", "landscape"]),
    }).parse(input);
    const a = await db.creativeAsset.create({
      data: { businessId: user.businessId, kind: "graphic", title: i.title, provider: "builtin", status: "succeeded", dataUrl: i.dataUrl, mimeType: i.dataUrl.slice(5, i.dataUrl.indexOf(";")), createdById: user.id, meta: { template: i.template, size: i.size } },
    });
    await audit({ businessId: user.businessId, userId: user.id, action: "creative.graphic_save", entityType: "CreativeAsset", entityId: a.id });
    revalidatePath("/creative");
  });
}

/** Approval flow: anyone with edit rights submits; only the owner approves/rejects. Approved assets may be used publicly. */
export async function creativeApprovalAction(fd: FormData) {
  const op = z.enum(["submit", "approve", "reject"]).parse(fd.get("op"));
  const user = await requireUser(op === "submit" ? "creative.edit" : "approvals.decide");
  const id = String(fd.get("id"));
  const from = op === "submit" ? ["draft", "rejected"] : ["pending_approval", "draft"];
  const to = op === "submit" ? "pending_approval" : op === "approve" ? "approved" : "rejected";
  const r = await db.creativeAsset.updateMany({ where: { id, businessId: user.businessId, approval: { in: from }, status: "succeeded" }, data: { approval: to } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: `creative.${op}`, entityType: "CreativeAsset", entityId: id });
  revalidatePath("/creative");
}

export async function deleteCreativeAction(fd: FormData) {
  const user = await requireUser("creative.edit");
  const r = await db.creativeAsset.deleteMany({ where: { id: String(fd.get("id")), businessId: user.businessId, approval: { not: "approved" } } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "creative.delete", entityType: "CreativeAsset" });
  revalidatePath("/creative");
}

/** Creative agent writes a production-ready prompt for the chosen media type, using the brand kit. */
export async function writePromptAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("creative.edit");
    const { locale } = await getI18n();
    const kind = z.enum(KINDS).parse(fd.get("kind"));
    const idea = z.string().trim().min(3).max(1000).parse(fd.get("idea"));
    const kit = await db.brandKit.findUnique({ where: { businessId: user.businessId } });
    const brand = kit ? `Brand: ${kit.displayName}; colours ${kit.primaryColor}/${kit.accentColor}; style: ${kit.visualStyle ?? "black & gold luxury"}; tone: ${kit.voiceTone ?? "premium, warm"}.` : "Brand: CASTEL STUDIO — black & gold luxury men's barbershop.";
    const task = kind === "voiceover"
      ? `Write a 20–30 second voice-over script in ${locale === "en" ? "English" : "Hebrew"} for: "${idea}". ${brand} Output only the script text.`
      : `Write ONE detailed English prompt for an AI ${kind === "model3d" ? "3D model" : kind === "video" || kind === "animation" ? "video" : "image"} generator for: "${idea}". ${brand} Include subject, composition, lighting, camera/lens, mood and style. No text/letters in the image. Output only the prompt.`;
    const r = await generateWithAgent({ user, agent: "creative", task, locale, title: `prompt: ${idea}` });
    if (!r.configured) return { error: locale === "he" ? "ספק AI לא מוגדר (ANTHROPIC_API_KEY)." : "No AI provider configured (ANTHROPIC_API_KEY)." };
    if (!r.text) return { error: locale === "he" ? "שגיאה מהספק" : "Provider error" };
    return { ok: true, message: r.text };
  });
}
