import { z } from "zod";

/**
 * MY CASTEL programs. Every program is OFF by default: nothing is promised to customers
 * until the owner turns it on and writes the reward in their own words.
 */
const text = (max: number) => z.string().trim().max(max).catch("");
export const ClubSettings = z.object({
  enabled: z.boolean().catch(false),
  visitsRequired: z.coerce.number().int().min(2).max(100).catch(10),
  rewardLabel: text(80),
  /// free_service | discount_percent | discount_amount | gift
  rewardType: z.enum(["free_service", "discount_percent", "discount_amount", "gift"]).catch("free_service"),
  rewardValue: z.coerce.number().min(0).max(10000).catch(0),
  premiumQualifies: z.boolean().catch(false),
  expiryDays: z.coerce.number().int().min(0).max(3650).catch(0), // 0 = never expires
  conditions: text(300),
});
export const VipSettings = z.object({
  enabled: z.boolean().catch(false),
  autoEnabled: z.boolean().catch(false),
  autoMinVisits: z.coerce.number().int().min(1).max(500).catch(20),
  benefits: z.array(z.string().trim().max(120)).max(8).catch([]),
  announcement: text(400),
  waitlistPriority: z.boolean().catch(true),
});
export const ReferralSettings = z.object({
  enabled: z.boolean().catch(false),
  referrerRewardLabel: text(80),
  friendRewardLabel: text(80),
  bothBenefit: z.boolean().catch(false),
  minCompleted: z.coerce.number().int().min(1).max(10).catch(1),
  maxPerCustomer: z.coerce.number().int().min(1).max(100).catch(10),
  expiryDays: z.coerce.number().int().min(0).max(3650).catch(0),
  conditions: text(300),
});
export const ReminderSettings = z.object({
  enabled: z.boolean().catch(false),
  h24: z.boolean().catch(true),
  h2: z.boolean().catch(false),
});
export type Club = z.infer<typeof ClubSettings>;
export type Vip = z.infer<typeof VipSettings>;
export type ReferralCfg = z.infer<typeof ReferralSettings>;
export type Reminders = z.infer<typeof ReminderSettings>;
export const parseClub = (v: unknown) => ClubSettings.parse(v ?? {});
export const parseVip = (v: unknown) => VipSettings.parse(v ?? {});
export const parseReferral = (v: unknown) => ReferralSettings.parse(v ?? {});
export const parseReminders = (v: unknown) => ReminderSettings.parse(v ?? {});

/**
 * Visits that count for CASTEL CLUB: completed only (never cancelled / no-show), at most one per calendar day
 * (a duplicate booking can't earn twice), premium appointments only when the owner allows it.
 */
export function qualifyingVisits(appts: { status: string; dayKey: string; premium: boolean }[], club: Pick<Club, "premiumQualifies">) {
  const days = new Set<string>();
  for (const a of appts) if (a.status === "COMPLETED" && (club.premiumQualifies || !a.premium)) days.add(a.dayKey);
  return days.size;
}

/** Where the customer stands: rewards earned so far (cycles) and progress inside the current card. */
export function clubProgress(visits: number, visitsRequired: number) {
  const cycles = Math.floor(visits / visitsRequired);
  const inCard = visits - cycles * visitsRequired;
  return { cycles, inCard, remaining: visitsRequired - inCard, required: visitsRequired };
}

export function rewardText(c: Pick<Club, "rewardLabel" | "rewardType" | "rewardValue">, he = true) {
  if (c.rewardLabel) return c.rewardLabel;
  switch (c.rewardType) {
    case "discount_percent": return he ? `${c.rewardValue}% הנחה על תספורת` : `${c.rewardValue}% off a haircut`;
    case "discount_amount": return he ? `₪${c.rewardValue} הנחה` : `₪${c.rewardValue} off`;
    case "gift": return he ? "מתנה מהמספרה" : "A gift from the shop";
    default: return he ? "תספורת חינם" : "A free haircut";
  }
}

/** Friendly, unambiguous referral codes (no 0/O/1/I). */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeReferralCode(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)) {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[rand(ALPHA.length)];
  return `CS-${s}`;
}
export const isReferralCode = (v: unknown): v is string => typeof v === "string" && /^CS-[A-HJ-NP-Z2-9]{6}$/.test(v);

/** A slot fits a waitlist request when it starts inside the customer's time range. */
export const fitsWindow = (startMin: number, fromMin: number, toMin: number) => startMin >= fromMin && startMin < toMin;
