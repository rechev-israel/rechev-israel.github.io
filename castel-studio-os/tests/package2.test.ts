import { describe, expect, it } from "vitest";
import { loyaltyTier, nextMilestone } from "@/domain/loyalty";
import { profitAndLoss } from "@/domain/finance";
import { hashPortalToken, isPlausibleToken, newPortalToken } from "@/server/academy/portal";
import { contactDecision } from "@/server/comms/messages";
import { BUILTIN_AUTOMATIONS } from "@/server/automation/defaults";
import { definitionSchema, evaluateConditions } from "@/server/automation/definition";

describe("loyalty", () => {
  it("tiers by visits or spend", () => {
    expect(loyaltyTier(0, 0)).toBe("NEW");
    expect(loyaltyTier(5, 0)).toBe("SILVER");
    expect(loyaltyTier(2, 1600)).toBe("GOLD");
    expect(loyaltyTier(20, 0)).toBe("PLATINUM");
  });
  it("next milestone", () => {
    expect(nextMilestone(3)).toEqual({ at: 5, remaining: 2 });
    expect(nextMilestone(10)).toEqual({ at: 20, remaining: 10 });
    expect(nextMilestone(200)).toBeNull();
  });
  it("milestone automation fires only on milestone visits", () => {
    const b = BUILTIN_AUTOMATIONS.find((x) => x.key === "loyalty_milestone")!;
    expect(definitionSchema.safeParse(b.definition).success).toBe(true);
    expect(evaluateConditions(b.definition.conditions, { customer: { visitCount: 10 } }).pass).toBe(true);
    expect(evaluateConditions(b.definition.conditions, { customer: { visitCount: 11 } }).pass).toBe(false);
  });
});

describe("profit & loss", () => {
  const d = (s: string) => new Date(s + "T12:00:00Z");
  it("builds category rows, totals, net and margin from actuals only", () => {
    const pnl = profitAndLoss([
      { type: "INCOME", kind: "ACTUAL", amount: 1000, occurredAt: d("2026-10-03"), category: "services" },
      { type: "INCOME", kind: "ACTUAL", amount: 5500, occurredAt: d("2026-11-03"), category: "academy" },
      { type: "EXPENSE", kind: "ACTUAL", amount: 2000, occurredAt: d("2026-11-01"), category: "rent" },
      { type: "INCOME", kind: "ESTIMATE", amount: 9999, occurredAt: d("2026-11-05"), category: "services" },
    ], ["2026-10", "2026-11"]);
    const row = (l: string) => pnl.rows.find((r) => r.label === l)!;
    expect(row("TOTAL_INCOME").values).toEqual([1000, 5500]);
    expect(row("NET").values).toEqual([1000, 3500]);
    expect(row("NET").total).toBe(4500);
    expect(pnl.marginPct).toEqual([100, 63.6]);
  });
});

describe("student portal tokens", () => {
  it("are high-entropy, hashed, and format-checked", () => {
    const a = newPortalToken(); const b = newPortalToken();
    expect(a.token).not.toBe(b.token);
    expect(isPlausibleToken(a.token)).toBe(true);
    expect(a.hash).toBe(hashPortalToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(isPlausibleToken("../../etc")).toBe(false);
  });
});

describe("student messaging rules", () => {
  it("service messages allowed, marketing never, dropped students blocked", () => {
    const st = { phone: "+972501112222", email: null, status: "ACTIVE" };
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", student: st }).ok).toBe(true);
    expect(contactDecision({ channel: "WHATSAPP", purpose: "marketing", student: st }).ok).toBe(false);
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", student: { ...st, status: "DROPPED" } }).ok).toBe(false);
  });
});
