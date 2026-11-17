/** List prices in USD per 1M tokens (input / output). Used for ESTIMATED cost display only. */
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-fable-5-2": { in: 8, out: 40 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return Math.round(((inputTokens * p.in + outputTokens * p.out) / 1_000_000) * 1e6) / 1e6;
}
