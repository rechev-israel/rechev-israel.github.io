import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/server/auth/session";
import { getAiProvider } from "./provider";
import { estimateCostUsd } from "./pricing";
import { aiBudgetStatus } from "./orchestrator";

export const CONSENT_VERSION = "twin-consent-v1";

export type TwinScope = "chat" | "voice" | "avatar";

/** The twin is usable for a scope only with active, explicit consent that includes that scope. */
export function twinAllows(profile: { consentGiven: boolean; revokedAt: Date | null; consentScopes: string[] } | null, scope: TwinScope) {
  return Boolean(profile && profile.consentGiven && !profile.revokedAt && profile.consentScopes.includes(scope));
}

/** Pure prompt builder — the twin may only use owner-approved knowledge. */
export function twinSystemPrompt(ownerName: string, persona: string | null, knowledge: { title: string; body: string }[], locale: string) {
  return [
    `You are the AI assistant representing ${ownerName}, owner of CASTEL STUDIO (premium men's barbershop & barber academy, Ashkelon).`,
    `You speak in ${ownerName}'s style${persona ? `: ${persona}` : ""}. Reply in ${locale === "en" ? "English" : "Hebrew"} unless asked otherwise.`,
    `Always be transparent that you are an AI assistant, never claim to be ${ownerName} personally.`,
    `Answer ONLY from the approved knowledge below. If the answer is not in it, say you don't know and suggest contacting the studio. Never invent prices, availability or policies.`,
    `Approved knowledge:`,
    ...(knowledge.length ? knowledge.map((k, i) => `[${i + 1}] ${k.title}: ${k.body}`) : ["(none yet)"]),
  ].join("\n");
}

export async function askTwin(user: SessionUser, question: string, locale: string) {
  const profile = await db.twinProfile.findUnique({ where: { businessId: user.businessId } });
  if (!twinAllows(profile, "chat")) return { ok: false as const, reason: "no_consent" };
  const provider = getAiProvider();
  if (!provider) return { ok: false as const, reason: "not_configured" };
  const budget = await aiBudgetStatus(user.businessId);
  if (budget.exceeded) return { ok: false as const, reason: "budget" };
  const knowledge = await db.knowledgeItem.findMany({ where: { businessId: user.businessId, approved: true }, select: { title: true, body: true }, orderBy: { updatedAt: "desc" }, take: 80 });
  const convo = await db.aiConversation.create({ data: { businessId: user.businessId, userId: user.id, agent: "twin", title: question.slice(0, 80) } });
  await db.aiMessage.create({ data: { conversationId: convo.id, role: "user", content: question, agent: "twin" } });
  try {
    const r = await provider.chat({ system: twinSystemPrompt(profile!.ownerName, profile!.persona, knowledge, locale), messages: [{ role: "user", content: question }] });
    const text = r.refused ? "" : r.text;
    await db.aiMessage.create({ data: { conversationId: convo.id, role: "assistant", content: text || "(empty)", agent: "twin", provider: provider.id, model: provider.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: estimateCostUsd(provider.model, r.inputTokens, r.outputTokens) } });
    return { ok: true as const, text, knowledgeCount: knowledge.length };
  } catch (e) {
    logger.error("twin.ask_failed", { err: String(e) });
    return { ok: false as const, reason: "error" };
  }
}
