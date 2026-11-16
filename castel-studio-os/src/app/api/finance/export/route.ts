import { db } from "@/lib/db";
import { requireApiUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { toCsv } from "@/lib/utils";
import { toLocalInput } from "@/lib/dates";

export async function GET(req: Request) {
  const r = await requireApiUser(req, "finance.view");
  if ("error" in r) return r.error;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const rows = await db.transaction.findMany({
    where: {
      businessId: r.user.businessId,
      occurredAt: { ...(from ? { gte: new Date(from + "T00:00:00Z") } : {}), ...(to ? { lte: new Date(to + "T23:59:59Z") } : {}) },
    },
    orderBy: { occurredAt: "asc" },
  });
  const csv = toCsv(
    ["date", "type", "kind", "category", "amount_ils", "method", "description", "id"],
    rows.map((x) => [toLocalInput(x.occurredAt, false), x.type, x.kind, x.category, x.amount.toString(), x.method, x.description, x.id]),
  );
  await audit({ businessId: r.user.businessId, userId: r.user.id, action: "finance.export", entityType: "Transaction", metadata: { count: rows.length, from, to } });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="castel-transactions-${from ?? "all"}-${to ?? "now"}.csv"`, "Cache-Control": "no-store" },
  });
}
