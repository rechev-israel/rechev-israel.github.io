import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/rbac";
import type { SessionUser } from "@/server/auth/session";
import { buildAiContext } from "@/server/services/metrics";
import { AGENTS, type AgentId } from "./agents";
import { routeRequest } from "./router";
import { getAiProvider, type ChatTurn } from "./provider";

function systemPrompt(agent: AgentId, locale: string, context: unknown) {
  const a = AGENTS[agent];
  return [
    `You are the ${a.id.toUpperCase()} specialist in the AI team of CASTEL STUDIO — a premium men's barbershop and barber education academy in Ashkelon, Israel.`,
    `Your role: ${a.brief}`,
    `Brand voice: premium, confident, warm, masculine-luxury; black & gold aesthetic. Instagram: @castel.cutzz.`,
    `Reply in ${locale === "en" ? "English" : "Hebrew"} unless the user writes in another language.`,
    `Rules:`,
    `- Use ONLY the business data provided below. If data is missing, say so plainly and suggest what to record — never invent numbers, customers, reviews or campaign results.`,
    `- Clearly label any projection or assumption as an estimate. Financial output is management guidance, not tax or legal advice.`,
    `- You cannot send messages, publish, spend money or delete data. When the user explicitly asks for such an action, prepare the draft and call request_approval so the owner can review it; tell the user it is waiting in the Approvals center.`,
    `- Marketing messages may only target customers who opted in (Israeli anti-spam law, Amendment 40).`,
    `- Be concise and practical; use short headings and bullet lists where helpful.`,
    ``,
    `Business data (aggregated, JSON):`,
    JSON.stringify(context),
  ].join("\n");
}

export async function handleAiMessage(opts: {
  user: SessionUser;
  conversationId?: string | null;
  message: string;
  agent?: AgentId | "auto";
  locale: string;
}) {
  const { user, message } = opts;
  let agent: AgentId;
  let matched: string[] = [];
  if (opts.agent && opts.agent !== "auto") agent = opts.agent;
  else ({ agent, matched } = routeRequest(message));

  // Permission downgrade: finance agent requires finance data permission.
  const def = AGENTS[agent];
  if (def.requires && !can(user.role, def.requires)) agent = "ceo";

  const conversation = opts.conversationId
    ? await db.aiConversation.findFirst({ where: { id: opts.conversationId, businessId: user.businessId, userId: user.id } })
    : null;
  const convo =
    conversation ??
    (await db.aiConversation.create({
      data: { businessId: user.businessId, userId: user.id, agent, title: message.slice(0, 80) },
    }));

  await db.aiMessage.create({ data: { conversationId: convo.id, role: "user", content: message, agent } });

  const provider = getAiProvider();
  if (!provider) {
    return { conversationId: convo.id, agent, matched, configured: false as const, reply: null };
  }

  const history = await db.aiMessage.findMany({
    where: { conversationId: convo.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const context = await buildAiContext(user.businessId, AGENTS[agent].scopes, can(user.role, "ai.financeData"));

  const approvalsCreated: string[] = [];
  try {
    const result = await provider.chat({
      system: systemPrompt(agent, opts.locale, context),
      messages: turns,
      onTool: async (name, input) => {
        if (name !== "request_approval") throw new Error("Unknown tool");
        const i = input as { kind: string; title: string; details: string };
        const req = await db.approvalRequest.create({
          data: {
            businessId: user.businessId,
            kind: i.kind,
            title: String(i.title).slice(0, 200),
            payload: { details: String(i.details), conversationId: convo.id },
            requestedById: user.id,
            requestedByAgent: agent,
          },
        });
        approvalsCreated.push(req.id);
        await audit({ businessId: user.businessId, userId: user.id, action: "approval.create", entityType: "ApprovalRequest", entityId: req.id, metadata: { agent, kind: i.kind } });
        return `Approval request ${req.id} created and pending owner review. The action has NOT been performed.`;
      },
    });
    const reply = result.refused
      ? opts.locale === "en" ? "The model declined this request." : "המודל סירב לבקשה זו."
      : result.text || (opts.locale === "en" ? "(empty response)" : "(תשובה ריקה)");
    await db.aiMessage.create({
      data: { conversationId: convo.id, role: "assistant", content: reply, agent, provider: provider.id, model: provider.model },
    });
    await db.aiConversation.update({ where: { id: convo.id }, data: { agent } });
    return { conversationId: convo.id, agent, matched, configured: true as const, reply, approvalsCreated };
  } catch (err) {
    logger.error("ai.chat_failed", { err: String(err), agent });
    return { conversationId: convo.id, agent, matched, configured: true as const, reply: null, error: true };
  }
}
