import { db } from "@/lib/db";
import { leadPublicSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { emitEvent } from "@/server/automation/engine";

/** Public academy lead capture. Rate limited, honeypot-protected, requires explicit consent. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`lead:${ip}`, 5, 10 * 60_000).ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = leadPublicSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 422 });
  const d = parsed.data;
  if (!d.phone && !d.email) return Response.json({ error: "validation", issues: ["phone"] }, { status: 422 });
  const business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) return Response.json({ error: "unavailable" }, { status: 503 });
  const course = d.courseCode ? await db.course.findFirst({ where: { businessId: business.id, code: d.courseCode } }) : null;
  const lead = await db.lead.create({
    data: { businessId: business.id, courseId: course?.id, name: d.name, phone: d.phone ?? null, email: d.email ?? null, message: d.message ?? null, consent: true, source: d.source ?? "landing:/join", kind: d.kind ?? (course || !d.source ? "academy" : "barbershop") },
  });
  logger.info("lead.created", { leadId: lead.id, course: d.courseCode ?? null });
  await emitEvent(business.id, "lead.created", {
    lead: { id: lead.id, name: lead.name, status: lead.status, kind: lead.kind, source: lead.source, courseName: course ? course.nameHe : null },
  });
  return Response.json({ ok: true }, { status: 201 });
}
