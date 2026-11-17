"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { emitEvent } from "@/server/automation/engine";
import { generateWithAgent } from "@/server/ai/orchestrator";
import { getI18n } from "@/i18n";
import { formToObject, type ActionState } from "@/lib/validation";
import { runAction } from "./util";

const opt = (max: number) => z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(max).optional());
const optNum = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().min(0).max(1e9).optional());
const optDate = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional());

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  objective: opt(300),
  channel: z.enum(["instagram", "tiktok", "meta-ads", "google-ads", "whatsapp", "email", "offline", "other"]),
  audience: opt(500),
  budget: optNum,
  startsAt: optDate,
  endsAt: optDate,
});

export async function saveCampaignAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const i = campaignSchema.parse(formToObject(fd));
    const data = { name: i.name, objective: i.objective ?? null, channel: i.channel, audience: i.audience ?? null, budget: i.budget ?? null, startsAt: i.startsAt ? new Date(i.startsAt + "T00:00:00Z") : null, endsAt: i.endsAt ? new Date(i.endsAt + "T23:59:59Z") : null };
    if (id) {
      const r = await db.campaign.updateMany({ where: { id, businessId: user.businessId }, data });
      if (!r.count) throw new Error("not found");
    } else await db.campaign.create({ data: { ...data, businessId: user.businessId, status: "draft" } });
    await audit({ businessId: user.businessId, userId: user.id, action: id ? "campaign.update" : "campaign.create", entityType: "Campaign", entityId: id });
    revalidatePath("/marketing");
  });
}

export async function saveCampaignResultsAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const i = z.object({ spendActual: optNum, impressions: optNum, clicks: optNum, leads: optNum, conversions: optNum }).parse(formToObject(fd));
    const r = await db.campaign.updateMany({
      where: { id, businessId: user.businessId },
      data: { spendActual: i.spendActual ?? null, impressions: i.impressions ?? null, clicks: i.clicks ?? null, leads: i.leads ?? null, conversions: i.conversions ?? null },
    });
    if (!r.count) throw new Error("not found");
    revalidatePath("/marketing");
  });
}

const FLOW: Record<string, string[]> = { draft: ["pending_approval"], pending_approval: ["draft"], approved: ["live", "draft"], live: ["ended"], ended: [] };

export async function campaignStatusAction(fd: FormData) {
  const user = await requireUser("marketing.edit");
  const id = String(fd.get("id"));
  const to = String(fd.get("status"));
  const c = await db.campaign.findFirst({ where: { id, businessId: user.businessId } });
  if (!c || !(FLOW[c.status] ?? []).includes(to)) return;
  await db.campaign.update({ where: { id }, data: { status: to } });
  await audit({ businessId: user.businessId, userId: user.id, action: `campaign.${to}`, entityType: "Campaign", entityId: id });
  if (to === "pending_approval") {
    await emitEvent(user.businessId, "campaign.submitted", { campaign: { id: c.id, name: c.name, channel: c.channel, budget: Number(c.budget ?? 0) } });
  }
  revalidatePath("/marketing");
}

/** Only the owner approves a campaign (it may involve spending money / publishing). */
export async function approveCampaignAction(fd: FormData) {
  const user = await requireUser("approvals.decide");
  const id = String(fd.get("id"));
  const r = await db.campaign.updateMany({ where: { id, businessId: user.businessId, status: "pending_approval" }, data: { status: "approved" } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "campaign.approve", entityType: "Campaign", entityId: id });
  revalidatePath("/marketing");
}

const contentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  platform: z.enum(["instagram", "tiktok", "facebook", "other"]),
  format: z.enum(["post", "reel", "story", "carousel", "video"]),
  caption: opt(4000),
  hashtags: z.preprocess((v) => (typeof v === "string" ? v.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)) : []), z.array(z.string().max(60)).max(30)),
  scheduledFor: optDate,
  campaignId: opt(40),
  status: z.enum(["idea", "draft", "pending_approval", "approved", "published"]).default("idea"),
});

export async function saveContentAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const i = contentSchema.parse(formToObject(fd));
    if (i.campaignId && !(await db.campaign.findFirst({ where: { id: i.campaignId, businessId: user.businessId } }))) throw new Error("campaign not found");
    // "published" is recorded manually after the owner posts it — the system does not publish to social networks.
    const data = { ...i, caption: i.caption ?? null, campaignId: i.campaignId ?? null, scheduledFor: i.scheduledFor ? new Date(i.scheduledFor + "T09:00:00Z") : null };
    if (id) {
      const r = await db.contentItem.updateMany({ where: { id, businessId: user.businessId }, data });
      if (!r.count) throw new Error("not found");
    } else await db.contentItem.create({ data: { ...data, businessId: user.businessId } });
    revalidatePath("/marketing");
  });
}

export async function saveContentMetricsAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const i = z.object({ views: optNum, likes: optNum, comments: optNum, saves: optNum, leads: optNum }).parse(formToObject(fd));
    const r = await db.contentItem.updateMany({ where: { id, businessId: user.businessId }, data: { views: i.views ?? null, likes: i.likes ?? null, comments: i.comments ?? null, saves: i.saves ?? null, leads: i.leads ?? null } });
    if (!r.count) throw new Error("not found");
    revalidatePath("/marketing");
  });
}

export async function deleteContentAction(fd: FormData) {
  const user = await requireUser("marketing.edit");
  await db.contentItem.deleteMany({ where: { id: String(fd.get("id")), businessId: user.businessId } });
  revalidatePath("/marketing");
}

/** AI generators. Real model output only — when no provider is configured the UI says so. */
export async function generateMarketingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("marketing.edit");
    const { locale } = await getI18n();
    const L = (he: string, en: string) => (locale === "he" ? he : en);
    const kind = z.enum(["caption", "hashtags", "strategy", "calendar", "ad"]).parse(fd.get("kind"));
    const topic = z.string().trim().min(3).max(1000).parse(fd.get("topic"));
    const platform = String(fd.get("platform") || "instagram").slice(0, 20);
    const lang = locale === "en" ? "English" : "Hebrew";
    const tasks: Record<typeof kind, string> = {
      caption: `Write 3 alternative ${platform} captions in ${lang} for CASTEL STUDIO about: "${topic}". Premium, warm, short lines, 1–3 emojis, a clear call to action (book via link in bio / WhatsApp). Number them.`,
      hashtags: `Suggest 25 ${platform} hashtags for CASTEL STUDIO (men's barbershop & barber academy in Ashkelon, Israel) about: "${topic}". Mix Hebrew and English, local (Ashkelon/Israel) and niche (barber/fade/academy). Output as one space-separated line, then a one-line note on which 5 to prioritise.`,
      strategy: `Create a practical campaign strategy in ${lang} for: "${topic}". Include: goal & KPI, target audience, offer, channels (Instagram/TikTok/WhatsApp/Meta Ads), 4-week timeline, content pillars, suggested budget split in ILS (label as a suggestion), and how to measure success. Base it on the business data provided; do not invent results.`,
      calendar: `Plan a 4-week ${platform} content calendar in ${lang} for: "${topic}". 3 posts per week. For each: day, format (reel/post/story/carousel), hook, short caption idea, and 5 hashtags. Use a table-like list.`,
      ad: `Write ad copy in ${lang} for a ${platform} ad about: "${topic}". Give 3 variants, each with: primary text (max 125 chars), headline (max 40 chars), description, and CTA. Do not promise results you cannot guarantee.`,
    };
    const agent = kind === "strategy" ? "marketing" : "creative";
    const r = await generateWithAgent({ user, agent, task: tasks[kind], locale, title: `${kind}: ${topic}` });
    if (!r.configured) return { error: L("ספק AI לא מוגדר. הוסיפו ANTHROPIC_API_KEY ב-Vercel כדי להפעיל את המחוללים.", "No AI provider configured. Add ANTHROPIC_API_KEY in Vercel to enable the generators.") };
    if (!r.text) return { error: L("שגיאה בקבלת תשובה מהספק", "Error getting a response from the provider") };
    return { ok: true, message: r.text };
  });
}
