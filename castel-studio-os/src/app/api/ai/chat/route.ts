import { z } from "zod";
import { requireApiUser } from "@/server/auth/session";
import { handleAiMessage } from "@/server/ai/orchestrator";
import { AGENT_IDS } from "@/server/ai/agents";
import { rateLimit } from "@/lib/rate-limit";
import { getLocale } from "@/i18n";

const body = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().max(40).nullish(),
  agent: z.enum(["auto", ...AGENT_IDS] as [string, ...string[]]).default("auto"),
});

export async function POST(req: Request) {
  const r = await requireApiUser(req, "ai.use");
  if ("error" in r) return r.error;
  if (!rateLimit(`ai:${r.user.id}`, 30, 60 * 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 422 });
  const result = await handleAiMessage({
    user: r.user,
    message: parsed.data.message,
    conversationId: parsed.data.conversationId,
    agent: parsed.data.agent as never,
    locale: await getLocale(),
  });
  return Response.json(result);
}
