import type { CustomerStatus } from "@prisma/client";

export const SEGMENT_RULES = {
  atRiskDays: 45,
  lapsedDays: 90,
  vipSpend: 3000,
  vipVisits: 15,
};

/** Derive a retention segment from visit history. BLOCKED is manual and never overridden. */
export function computeSegment(
  c: { status: CustomerStatus; lastVisitAt: Date | null; visitCount: number; totalSpent: number },
  now = new Date(),
): CustomerStatus {
  if (c.status === "BLOCKED") return "BLOCKED";
  if (!c.lastVisitAt) return "ACTIVE"; // new customer, no history yet
  const days = (now.getTime() - c.lastVisitAt.getTime()) / 86400_000;
  if (days > SEGMENT_RULES.lapsedDays) return "LAPSED";
  if (days > SEGMENT_RULES.atRiskDays) return "AT_RISK";
  if (c.totalSpent >= SEGMENT_RULES.vipSpend || c.visitCount >= SEGMENT_RULES.vipVisits) return "VIP";
  return "ACTIVE";
}

/** Normalise Israeli phone numbers to E.164 (+972…). Returns null if not plausible. */
export function normalizeIsraeliPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("972")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (!/^\d{8,9}$/.test(d)) return null;
  return "+972" + d;
}

export function upcomingBirthday(birthday: Date | null, now = new Date(), withinDays = 14) {
  if (!birthday) return null;
  const b = new Date(birthday);
  const next = new Date(Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (next < today) next.setUTCFullYear(next.getUTCFullYear() + 1);
  const days = Math.round((next.getTime() - today.getTime()) / 86400_000);
  return days <= withinDays ? days : null;
}

/** Whether a customer may receive marketing on a channel. Unknown = not allowed (opt-in model). */
export function canMarketTo(
  c: { marketingConsentSms: string; marketingConsentEmail: string; marketingConsentWhatsapp: string; status: string },
  channel: "SMS" | "EMAIL" | "WHATSAPP",
) {
  if (c.status === "BLOCKED") return false;
  const v = channel === "SMS" ? c.marketingConsentSms : channel === "EMAIL" ? c.marketingConsentEmail : c.marketingConsentWhatsapp;
  return v === "OPTED_IN";
}
