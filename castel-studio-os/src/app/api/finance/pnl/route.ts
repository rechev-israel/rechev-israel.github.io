import { requireApiUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { toCsv } from "@/lib/utils";
import { addMonths, startOfMonth } from "@/lib/dates";
import { profitAndLoss } from "@/domain/finance";
import { getTransactions, lastMonths } from "@/server/services/metrics";

/** 12-month profit & loss (actual transactions only) as CSV. Internal management report — not a tax document. */
export async function GET(req: Request) {
  const r = await requireApiUser(req, "finance.view");
  if ("error" in r) return r.error;
  const months = lastMonths(12);
  const txs = await getTransactions(r.user.businessId, addMonths(startOfMonth(), -11));
  const pnl = profitAndLoss(txs, months);
  const headers = ["line", ...months, "total"];
  const rows = pnl.rows.map((row) => [row.label, ...row.values, row.total]);
  await audit({ businessId: r.user.businessId, userId: r.user.id, action: "finance.export_pnl", entityType: "Transaction" });
  return new Response(toCsv(headers, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="castel-pnl-${months[0]}-${months[11]}.csv"`, "Cache-Control": "no-store" } });
}
