import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { publicBusiness } from "@/server/services/online-booking";
import { getExperience } from "@/server/services/experience";
import { giftByToken, requestGift } from "@/server/services/client-features";
import { clientIp } from "../booking/errors";
import { preflight, withCors } from "../booking/cors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
const json = (req: Request, data: unknown, status = 200) => withCors(req, Response.json(data, { status, headers: { "Cache-Control": "no-store" } }));

/** GET ?t=<private link> → the buyer's card; GET (no t) → what can be gifted (only when the owner enabled gift cards). */
export async function GET(req: Request) {
  if (!rateLimit(`gift:${clientIp(req)}`, 60, 60_000).ok) return json(req, { error: "rate_limited" }, 429);
  const t = new URL(req.url).searchParams.get("t");
  if (t) { const g = await giftByToken(t); return g ? json(req, g) : json(req, { error: "not_found" }, 404); }
  const b = await publicBusiness();
  if (!b) return json(req, { enabled: false });
  const cfg = (await getExperience(b.id)).gifts;
  if (!cfg.enabled) return json(req, { enabled: false });
  const services = cfg.allowServices ? await db.service.findMany({ where: { businessId: b.id, isActive: true, bookableOnline: true, premiumOnly: false }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }], select: { id: true, nameHe: true, nameEn: true, price: true } }) : [];
  return json(req, { enabled: true, amounts: cfg.amounts, services: services.map((s) => ({ id: s.id, he: s.nameHe, en: s.nameEn, price: Number(s.price) })), expiryMonths: cfg.expiryMonths, terms: cfg.terms, payNote: cfg.payNote });
}

/** A gift card request (no payment online — the shop confirms payment, then the code is issued). */
export async function POST(req: Request) {
  if (!rateLimit(`giftpost:${clientIp(req)}`, 5, 10 * 60_000).ok) return json(req, { error: "rate_limited" }, 429);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.website) return json(req, { ok: true });
  try { return json(req, { ok: true, ...(await requestGift(body)) }, 201); }
  catch (e) { const m = e instanceof Error ? e.message : "server"; return json(req, { error: ["invalid", "disabled"].includes(m) ? m : "server" }, m === "disabled" ? 403 : 400); }
}
