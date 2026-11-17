import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import { can } from "@/server/auth/rbac";
import type { SessionUser } from "@/server/auth/session";
import { buildAiContext } from "@/server/services/metrics";
import { AGENTS, type AgentId } from "./agents";
import { routeRequest } from "./router";
import { getAiProvider, REQUEST_APPROVAL_TOOL, Anthropic, type ChatTurn } from "./provider";
import { estimateCostUsd } from "./pricing";
import { addDays, startOfDay } from "@/lib/dates";
import { secret } from "@/server/secrets/store";

const CREATE_TASK_TOOL: Anthropic.Beta.BetaTool = {
  name: "create_task",
  description: "Create an internal task in the CASTEL STUDIO task list (internal only, nothing is sent to customers). Use when the user asks to remember, schedule or assign follow-up work.",
  strict: true,
  input_schema: {
    type: "object", additionalProperties: false, required: ["title", "due_in_days", "priority"],
    properties: { title: { type: "string" }, details: { type: "string" }, due_in_days: { type: "integer" }, priority: { type: "integer", enum: [1, 2, 3] } },
  },
};

const CREATE_CONTENT_TOOL: Anthropic.Beta.BetaTool = {
  name: "create_content_idea",
  description: "Save a social-media content idea to the Marketing content calendar as an unpublished draft (nothing is published). Use when the user asks to save/plan posts.",
  strict: true,
  input_schema: {
    type: "object", additionalProperties: false, required: ["platform", "format", "title", "caption", "hashtags"],
    properties: {
      platform: { type: "string", enum: ["instagram", "tiktok", "facebook", "other"] },
      format: { type: "string", enum: ["post", "reel", "story", "carousel", "video"] },
      title: { type: "string" }, caption: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
      scheduled_date: { type: "string", description: "YYYY-MM-DD, optional" },
    },
  },
};

/** Monthly AI spend cap (USD, estimated from list prices). Unset = no cap. */
export async function aiBudgetStatus(businessId: string) {
  const cap = Number(secret("AI_MONTHLY_BUDGET_USD"));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const agg = await db.aiMessage.aggregate({ where: { conversation: { businessId }, createdAt: { gte: monthStart } }, _sum: { costUsd: true } });
  const spent = Number(agg._sum.costUsd ?? 0);
  return { cap: Number.isFinite(cap) && cap > 0 ? cap : null, spent, exceeded: Number.isFinite(cap) && cap > 0 && spent >= cap };
}

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
    `- Internal tools you may use when helpful: create_task (internal to-do) and create_content_idea (saves an unpublished draft to the content calendar). Tell the user what you saved.`,
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
  const budget = await aiBudgetStatus(user.businessId);
  if (budget.exceeded) {
    const reply = opts.locale === "en" ? `Monthly AI budget reached ($${budget.spent.toFixed(2)} of $${budget.cap}). Raise AI_MONTHLY_BUDGET_USD to continue.` : `תקציב ה-AI החודשי נוצל ($${budget.spent.toFixed(2)} מתוך $${budget.cap}). העלו את AI_MONTHLY_BUDGET_USD כדי להמשיך.`;
    await db.aiMessage.create({ data: { conversationId: convo.id, role: "assistant", content: reply, agent } });
    return { conversationId: convo.id, agent, matched, configured: true as const, reply };
  }

  const history = await db.aiMessage.findMany({
    where: { conversationId: convo.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const context = await buildAiContext(user.businessId, AGENTS[agent].scopes, can(user.role, "ai.financeData"));

  const approvalsCreated: string[] = [];
  const tools = [REQUEST_APPROVAL_TOOL, ...(can(user.role, "tasks.edit") ? [CREATE_TASK_TOOL] : []), ...(can(user.role, "marketing.edit") ? [CREATE_CONTENT_TOOL] : [])];
  try {
    const result = await provider.chat({
      system: systemPrompt(agent, opts.locale, context),
      messages: turns,
      tools,
      onTool: async (name, input) => {
        if (name === "create_task" && can(user.role, "tasks.edit")) {
          const i = input as { title: string; details?: string; due_in_days: number; priority: number };
          const task = await db.task.create({
            data: { businessId: user.businessId, title: String(i.title).slice(0, 200), details: i.details ? String(i.details).slice(0, 2000) : null, priority: Math.min(3, Math.max(1, Number(i.priority) || 2)), dueAt: addDays(startOfDay(), Math.min(365, Math.max(0, Number(i.due_in_days) || 0))), assigneeId: user.id, source: "ai" },
          });
          await audit({ businessId: user.businessId, userId: user.id, action: "task.create_ai", entityType: "Task", entityId: task.id, metadata: { agent } });
          return `Task ${task.id} created.`;
        }
        if (name === "create_content_idea" && can(user.role, "marketing.edit")) {
          const i = input as { platform: string; format: string; title: string; caption: string; hashtags: string[]; scheduled_date?: string };
          const date = i.scheduled_date && /^\d{4}-\d{2}-\d{2}$/.test(i.scheduled_date) ? new Date(i.scheduled_date + "T09:00:00Z") : null;
          const item = await db.contentItem.create({
            data: { businessId: user.businessId, platform: i.platform, format: i.format, title: String(i.title).slice(0, 200), caption: String(i.caption).slice(0, 4000), hashtags: (i.hashtags ?? []).slice(0, 30).map((h) => String(h).replace(/^#?/, "#").slice(0, 60)), scheduledFor: date, status: "draft", notes: `AI (${agent})` },
          });
          return `Content idea ${item.id} saved as an unpublished draft in the content calendar.`;
        }
        if (name !== "request_approval") throw new Error("Unknown or unauthorized tool");
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
      data: {
        conversationId: convo.id, role: "assistant", content: reply, agent, provider: provider.id, model: provider.model,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: estimateCostUsd(provider.model, result.inputTokens, result.outputTokens),
      },
    });
    await db.aiConversation.update({ where: { id: convo.id }, data: { agent } });
    return { conversationId: convo.id, agent, matched, configured: true as const, reply, approvalsCreated };
  } catch (err) {
    logger.error("ai.chat_failed", { err: String(err), agent });
    await db.aiMessage.create({ data: { conversationId: convo.id, role: "system", content: "error", agent, provider: provider.id, model: provider.model, error: String(err).slice(0, 500) } }).catch(() => {});
    return { conversationId: convo.id, agent, matched, configured: true as const, reply: null, error: true };
  }
}

/**
 * One-shot generation for product features (caption / hashtag / strategy generators).
 * Stored as a conversation so usage & cost tracking stays complete. Returns null when no provider is configured.
 */
export async function generateWithAgent(opts: { user: SessionUser; agent: AgentId; task: string; locale: string; title: string }) {
  const provider = getAiProvider();
  if (!provider) return { configured: false as const, text: null };
  const budget = await aiBudgetStatus(opts.user.businessId);
  if (budget.exceeded) return { configured: true as const, text: opts.locale === "en" ? `Monthly AI budget reached ($${budget.spent.toFixed(2)} / $${budget.cap}).` : `תקציב ה-AI החודשי נוצל ($${budget.spent.toFixed(2)} / $${budget.cap}).` };
  const context = await buildAiContext(opts.user.businessId, AGENTS[opts.agent].scopes, can(opts.user.role, "ai.financeData"));
  const convo = await db.aiConversation.create({ data: { businessId: opts.user.businessId, userId: opts.user.id, agent: opts.agent, title: opts.title.slice(0, 80) } });
  await db.aiMessage.create({ data: { conversationId: convo.id, role: "user", content: opts.task, agent: opts.agent } });
  try {
    const r = await provider.chat({ system: systemPrompt(opts.agent, opts.locale, context), messages: [{ role: "user", content: opts.task }] });
    const text = r.refused ? "" : r.text;
    await db.aiMessage.create({
      data: { conversationId: convo.id, role: "assistant", content: text || "(empty)", agent: opts.agent, provider: provider.id, model: provider.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: estimateCostUsd(provider.model, r.inputTokens, r.outputTokens) },
    });
    return { configured: true as const, text, conversationId: convo.id };
  } catch (err) {
    logger.error("ai.generate_failed", { err: String(err), agent: opts.agent });
    await db.aiMessage.create({ data: { conversationId: convo.id, role: "system", content: "error", agent: opts.agent, error: String(err).slice(0, 500) } }).catch(() => {});
    return { configured: true as const, text: null, error: true };
  }
}
