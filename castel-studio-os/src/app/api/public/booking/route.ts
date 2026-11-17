import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createOnlineBooking, publicBusiness } from "@/server/services/online-booking";
import { bookingErrorResponse, clientIp } from "./errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  serviceId: z.string().regex(/^[a-z0-9]{8,40}$/i),
  staffId: z.string().regex(/^(any|[a-z0-9]{8,40})$/i),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().positive(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(9).max(20),
  notes: z.string().trim().max(500).optional(),
  marketingConsent: z.boolean().optional(),
  terms: z.literal(true),
  website: z.string().max(0).optional(), // honeypot
});

/** Public online booking. Rate limited, honeypot-protected; availability is re-validated server-side. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`book:${ip}`, 6, 10 * 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 422 });
  const b = await publicBusiness();
  if (!b) return Response.json({ error: "disabled" }, { status: 503 });
  try {
    const { token } = await createOnlineBooking(b.id, parsed.data);
    return Response.json({ ok: true, manageUrl: `/book/m/${token}` }, { status: 201 });
  } catch (e) {
    return bookingErrorResponse(e);
  }
}
