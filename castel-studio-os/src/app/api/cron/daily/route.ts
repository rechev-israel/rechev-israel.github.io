import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureBuiltinAutomations } from "@/server/automation/defaults";
import { processRetries, runScheduled } from "@/server/automation/engine";
import { flushDueMessages } from "@/server/comms/messages";
import { refreshCreativeJobs } from "@/server/creative/service";
import { hydrateSecrets } from "@/server/secrets/store";
import { recordCronRun } from "@/server/integrations/registry";

export const maxDuration = 60;

/**
 * Daily scheduler, invoked by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer $CRON_SECRET" when the CRON_SECRET env var is set; without it this endpoint refuses to run.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  await hydrateSecrets(true);
  const started = Date.now();
  for (const b of await db.business.findMany({ select: { id: true } })) await ensureBuiltinAutomations(db, b.id);
  const scheduled = await runScheduled();
  const retried = await processRetries();
  const messages = await flushDueMessages();
  const creative = await refreshCreativeJobs();
  const result = { scheduled, retried, messages, creative, ms: Date.now() - started };
  logger.info("cron.daily", result);
  await recordCronRun(result, req.headers.get("user-agent")).catch((e) => logger.warn("cron.record_failed", { err: String(e) }));
  return Response.json(result);
}
