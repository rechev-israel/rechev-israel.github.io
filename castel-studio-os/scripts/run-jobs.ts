/**
 * Background maintenance jobs. Run on a schedule (e.g. cron every night at 03:00 Asia/Jerusalem):
 *   npm run jobs
 * Phase 3 replaces this with a durable queue (automation engine with retries & run history).
 */
import { PrismaClient } from "@prisma/client";
import { recomputeCustomerStats } from "../src/server/services/crm";

const db = new PrismaClient();
const log = (msg: string, f: Record<string, unknown> = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", msg, ...f }));

async function main() {
  const expired = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  log("jobs.sessions_purged", { count: expired.count });
  for (const b of await db.business.findMany({ select: { id: true } })) {
    const changed = await recomputeCustomerStats(b.id);
    log("jobs.segments_recomputed", { businessId: b.id, changed });
  }
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ level: "error", msg: "jobs.failed", err: String(e) }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
