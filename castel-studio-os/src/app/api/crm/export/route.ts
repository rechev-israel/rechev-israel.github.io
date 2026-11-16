import { db } from "@/lib/db";
import { requireApiUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { toCsv } from "@/lib/utils";

export async function GET(req: Request) {
  const r = await requireApiUser(req, "crm.export");
  if ("error" in r) return r.error;
  const rows = await db.customer.findMany({ where: { businessId: r.user.businessId, archivedAt: null }, orderBy: { createdAt: "asc" } });
  const csv = toCsv(
    ["id", "firstName", "lastName", "phone", "email", "status", "visits", "totalSpent", "lastVisitAt", "source", "tags", "consentWhatsapp", "consentSms", "consentEmail", "createdAt"],
    rows.map((c) => [c.id, c.firstName, c.lastName, c.phone, c.email, c.status, c.visitCount, c.totalSpent.toString(), c.lastVisitAt, c.source, c.tags.join("|"), c.marketingConsentWhatsapp, c.marketingConsentSms, c.marketingConsentEmail, c.createdAt]),
  );
  await audit({ businessId: r.user.businessId, userId: r.user.id, action: "crm.export", entityType: "Customer", metadata: { count: rows.length } });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="castel-customers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
