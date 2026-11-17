import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ToolHandler = (name: string, input: unknown) => Promise<string>;
export type ChatResult = { text: string; refused: boolean; inputTokens: number; outputTokens: number };

export interface AiProvider {
  id: string;
  model: string;
  chat(opts: { system: string; messages: ChatTurn[]; onTool?: ToolHandler; tools?: Anthropic.Beta.BetaTool[] }): Promise<ChatResult>;
}

/** Tool the agents may call. It never performs the action — it only queues an approval request. */
export const REQUEST_APPROVAL_TOOL: Anthropic.Beta.BetaTool = {
  name: "request_approval",
  description:
    "Queue an external action (sending a message to customers, publishing content, spending ad budget, deleting data) for the owner's approval. The action is NOT performed — a human must approve it in the Approvals center. Use only when the user explicitly asks to send, publish, spend or delete.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "title", "details"],
    properties: {
      kind: { type: "string", enum: ["message.send", "content.publish", "ads.spend", "data.delete"] },
      title: { type: "string", description: "Short title shown to the owner" },
      details: { type: "string", description: "Full draft / proposal the owner will review" },
    },
  },
};

class AnthropicProvider implements AiProvider {
  id = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, public model: string) {
    this.client = new Anthropic({ apiKey, timeout: 120_000 });
  }

  async chat({ system, messages, onTool, tools }: { system: string; messages: ChatTurn[]; onTool?: ToolHandler; tools?: Anthropic.Beta.BetaTool[] }): Promise<ChatResult> {
    const convo: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
    let inputTokens = 0;
    let outputTokens = 0;
    for (let i = 0; i < 5; i++) {
      const res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: onTool ? tools ?? [REQUEST_APPROVAL_TOOL] : undefined,
        messages: convo,
      });
      inputTokens += (res.usage?.input_tokens ?? 0) + (res.usage?.cache_read_input_tokens ?? 0) + (res.usage?.cache_creation_input_tokens ?? 0);
      outputTokens += res.usage?.output_tokens ?? 0;
      if (res.stop_reason === "refusal") {
        logger.warn("ai.refusal", { category: res.stop_details?.category ?? null });
        return { text: "", refused: true, inputTokens, outputTokens };
      }
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      if (res.stop_reason !== "tool_use" || !onTool) return { text, refused: false, inputTokens, outputTokens };

      convo.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        try {
          results.push({ type: "tool_result", tool_use_id: block.id, content: await onTool(block.name, block.input) });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: block.id, content: String(err), is_error: true });
        }
      }
      convo.push({ role: "user", content: results });
    }
    return { text: "", refused: false, inputTokens, outputTokens };
  }
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getAiProvider(): AiProvider | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new AnthropicProvider(key, process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5");
}

export { Anthropic };
