import { AGENTS, AGENT_IDS, type AgentId } from "./agents";

/**
 * Deterministic, explainable router. Scores each specialist by keyword hits; falls back to the CEO agent.
 * Kept provider-independent so routing works (and is testable) without an AI key.
 */
export function routeRequest(message: string): { agent: AgentId; score: number; matched: string[] } {
  const text = message.toLowerCase();
  let best: { agent: AgentId; score: number; matched: string[] } = { agent: "ceo", score: 0, matched: [] };
  for (const id of AGENT_IDS) {
    const matched = AGENTS[id].keywords.filter((k) => text.includes(k));
    // longer keyword phrases are more specific → weigh by length
    const score = matched.reduce((s, k) => s + 1 + k.length / 20, 0);
    if (score > best.score) best = { agent: id, score, matched };
  }
  return best;
}
