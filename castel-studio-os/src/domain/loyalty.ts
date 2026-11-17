/** Loyalty tiers derived from real visit history (no points to game). */
export type Tier = "NEW" | "SILVER" | "GOLD" | "PLATINUM";

export const TIER_RULES = {
  PLATINUM: { visits: 20, spend: 4000 },
  GOLD: { visits: 10, spend: 1500 },
  SILVER: { visits: 5, spend: 500 },
} as const;

export const MILESTONES = [5, 10, 20, 30, 50, 75, 100];

export function loyaltyTier(visitCount: number, totalSpent: number): Tier {
  if (visitCount >= TIER_RULES.PLATINUM.visits || totalSpent >= TIER_RULES.PLATINUM.spend) return "PLATINUM";
  if (visitCount >= TIER_RULES.GOLD.visits || totalSpent >= TIER_RULES.GOLD.spend) return "GOLD";
  if (visitCount >= TIER_RULES.SILVER.visits || totalSpent >= TIER_RULES.SILVER.spend) return "SILVER";
  return "NEW";
}

/** Visits remaining until the next milestone (null when past the last one). */
export function nextMilestone(visitCount: number) {
  const m = MILESTONES.find((x) => x > visitCount);
  return m ? { at: m, remaining: m - visitCount } : null;
}
