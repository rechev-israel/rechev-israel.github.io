"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { askTwin, twinAllows, CONSENT_VERSION } from "@/server/ai/twin";
import { generateWithAgent } from "@/server/ai/orchestrator";
import { createGenerationJob } from "@/server/creative/service";
import { getI18n } from "@/i18n";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";
import { secret } from "@/server/secrets/store";


/** Owner-only explicit consent. Records exactly what was agreed, when, and by whom. */
export async function saveTwinConsentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const user = await requireUser("approvals.decide");
    const { locale } = await getI18n();
    const i = z.object({
      ownerName: z.string().trim().min(2).max(80),
      persona: z.string().trim().max(1500).optional(),
      scopes: z.array(z.enum(["chat", "voice", "avatar"])).min(1),
      agree: z.literal("on"),
      portraitUrl: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().refine((u) => u.startsWith("https://")).optional()),
      consentText: z.string().max(3000),
    }).safeParse({ ownerName: fd.get("ownerName"), persona: fd.get("persona") || undefined, scopes: fd.getAll("scopes").map(String), agree: fd.get("agree"), portraitUrl: fd.get("portraitUrl"), consentText: fd.get("consentText") });
    if (!i.success) return { error: locale === "he" ? "יש לאשר במפורש ולבחור לפחות הרשאה אחת." : "Explicit agreement and at least one scope are required." };
    const d = i.data;
    const data = { ownerName: d.ownerName, persona: d.persona ?? null, consentGiven: true, consentScopes: d.scopes, consentText: `${CONSENT_VERSION}\n${d.consentText}`, consentAt: new Date(), consentById: user.id, revokedAt: null, portraitUrl: d.scopes.includes("avatar") ? d.portraitUrl ?? null : null };
    await db.twinProfile.upsert({ where: { businessId: user.businessId }, create: { businessId: user.businessId, ...data }, update: data });
    await audit({ businessId: user.businessId, userId: user.id, action: "twin.consent_given", entityType: "TwinProfile", metadata: { scopes: d.scopes, version: CONSENT_VERSION } });
    revalidatePath("/twin");
  });
}

export async function revokeTwinConsentAction() {
  const user = await requireUser("approvals.decide");
  await db.twinProfile.updateMany({ where: { businessId: user.businessId }, data: { consentGiven: false, revokedAt: new Date(), consentScopes: [], portraitUrl: null } });
  await audit({ businessId: user.businessId, userId: user.id, action: "twin.consent_revoked", entityType: "TwinProfile" });
  revalidatePath("/twin");
}

export async function saveKnowledgeAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const i = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(4000) }).parse({ title: fd.get("title"), body: fd.get("body") });
    // Any edit returns the item to "not approved" until the owner re-approves it.
    if (id) {
      const r = await db.knowledgeItem.updateMany({ where: { id, businessId: user.businessId }, data: { ...i, approved: false } });
      if (!r.count) throw new Error("not found");
    } else await db.knowledgeItem.create({ data: { businessId: user.businessId, ...i, approved: false } });
    revalidatePath("/twin");
  });
}

export async function approveKnowledgeAction(fd: FormData) {
  const user = await requireUser("approvals.decide");
  const id = String(fd.get("id"));
  const approved = fd.get("approved") === "1";
  const r = await db.knowledgeItem.updateMany({ where: { id, businessId: user.businessId }, data: { approved } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: approved ? "twin.knowledge_approve" : "twin.knowledge_unapprove", entityType: "KnowledgeItem", entityId: id });
  revalidatePath("/twin");
}

export async function deleteKnowledgeAction(fd: FormData) {
  const user = await requireUser("marketing.edit");
  await db.knowledgeItem.deleteMany({ where: { id: String(fd.get("id")), businessId: user.businessId } });
  revalidatePath("/twin");
}

export async function askTwinAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("ai.use");
    const { locale } = await getI18n();
    const L = (he: string, en: string) => (locale === "he" ? he : en);
    const q = z.string().trim().min(2).max(1000).parse(fd.get("question"));
    const r = await askTwin(user, q, locale);
    if (!r.ok) return { error: { no_consent: L("התאום לא פעיל — נדרשת הסכמה מפורשת להרשאת שיחה.", "Twin inactive — explicit chat consent required."), not_configured: L("ספק AI לא מוגדר (ANTHROPIC_API_KEY).", "No AI provider (ANTHROPIC_API_KEY)."), budget: L("תקציב ה-AI החודשי נוצל.", "Monthly AI budget reached."), error: L("שגיאה מהספק", "Provider error") }[r.reason] };
    return { ok: true, message: r.text || "—" };
  });
}

/** Script for a marketing video in the owner's voice (text only, AI). */
export async function twinScriptAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const { locale } = await getI18n();
    const topic = z.string().trim().min(3).max(500).parse(fd.get("topic"));
    const profile = await db.twinProfile.findUnique({ where: { businessId: user.businessId } });
    if (!twinAllows(profile, "chat")) return { error: locale === "he" ? "נדרשת הסכמה פעילה." : "Active consent required." };
    const r = await generateWithAgent({ user, agent: "creative", locale, title: `twin script: ${topic}`, task: `Write a 30–45 second first-person video script in ${locale === "en" ? "English" : "Hebrew"} for ${profile!.ownerName} of CASTEL STUDIO about: "${topic}". Style: ${profile!.persona ?? "warm, confident, premium"}. Natural spoken language, a hook in the first line, one clear call to action. Output only the script.` });
    if (!r.configured) return { error: locale === "he" ? "ספק AI לא מוגדר." : "No AI provider configured." };
    return r.text ? { ok: true, message: r.text } : { error: "provider error" };
  });
}

/** Voice-over / avatar video in the owner's likeness — only with matching consent; results go to the library for approval. */
export async function twinMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState> => {
    const user = await requireUser("approvals.decide");
    const { locale } = await getI18n();
    const L = (he: string, en: string) => (locale === "he" ? he : en);
    const kind = z.enum(["voice", "avatar"]).parse(fd.get("kind"));
    const script = z.string().trim().min(10).max(2500).parse(fd.get("script"));
    const profile = await db.twinProfile.findUnique({ where: { businessId: user.businessId } });
    if (!twinAllows(profile, kind)) return { error: L("אין הסכמה פעילה להרשאה זו.", "No active consent for this scope.") };
    if (kind === "voice") {
      const voiceId = secret("ELEVENLABS_TWIN_VOICE_ID");
      if (!voiceId) return { error: L("לא הוגדר קול אישי (ELEVENLABS_TWIN_VOICE_ID) — יש ליצור אותו ב-ElevenLabs מדגימות שלך, בהסכמתך.", "No personal voice configured (ELEVENLABS_TWIN_VOICE_ID) — create it in ElevenLabs from your own samples.") };
      const a = await createGenerationJob(user, { kind: "voiceover", title: L("קול התאום", "Twin voice"), prompt: script, voiceId, tags: ["twin"] });
      revalidatePath("/creative");
      return a.status === "failed" ? { error: a.error ?? "error" } : { ok: true, message: a.status === "pending_config" ? L("ממתין להגדרת ElevenLabs", "Pending ElevenLabs configuration") : L("✓ נוצר — ממתין לאישור בספריית הנכסים", "✓ Created — awaiting approval in the asset library") };
    }
    if (!profile!.portraitUrl) return { error: L("חסר קישור לתמונת פורטרט מאושרת.", "Approved portrait URL missing.") };
    const a = await createGenerationJob(user, { kind: "avatar", title: L("וידאו אווטאר", "Avatar video"), prompt: script, imageUrl: profile!.portraitUrl, tags: ["twin"] });
    revalidatePath("/creative");
    return a.status === "failed" ? { error: a.error ?? "error" } : { ok: true, message: a.status === "pending_config" ? L("ממתין להגדרת ספק אווטאר (REPLICATE_MODEL_AVATAR)", "Pending avatar provider (REPLICATE_MODEL_AVATAR)") : L("✓ נשלח ליצירה — יופיע בספרייה לאישור", "✓ Submitted — will appear in the library for approval") };
  });
}
