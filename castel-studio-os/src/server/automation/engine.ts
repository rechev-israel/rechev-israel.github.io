import { Prisma, type Automation } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { addDays, startOfDay, toLocalInput, zonedParts } from "@/lib/dates";
import { formatILS, toNumber } from "@/lib/utils";
import { upcomingBirthday } from "@/domain/crm";
import { draftMessage } from "@/server/comms/messages";
import { getDashboardMetrics } from "@/server/services/metrics";
import { definitionSchema, evaluateConditions, retryDelayMs, TRIGGERS, type Action, type TriggerKey } from "./definition";

export type RunContext = Record<string, unknown> & {
  customer?: { id: string } & Record<string, unknown>;
  lead?: { id: string } & Record<string, unknown>;
  appointment?: { id: string } & Record<string, unknown>;
  campaign?: { id: string } & Record<string, unknown>;
};

type StepLog = { action: string; ok: boolean; detail?: string };

async function executeAction(a: Action, automation: Automation, ctx: RunContext, runId: string): Promise<StepLog> {
  const businessId = automation.businessId;
  switch (a.type) {
    case "message.draft": {
      if (!ctx.customer && !ctx.lead) return { action: a.type, ok: true, detail: "skipped: no recipient in context" };
      const appt = ctx.appointment as Record<string, unknown> | undefined;
      const m = await draftMessage({
        businessId,
        channel: a.channel,
        templateKey: a.templateKey,
        customerId: ctx.customer?.id ?? null,
        leadId: ctx.customer ? null : ctx.lead?.id ?? null,
        vars: {
          date: appt?.startsAt ? toLocalInput(appt.startsAt as Date, false).split("-").reverse().join("/") : "",
          time: appt?.startsAt ? toLocalInput(appt.startsAt as Date).slice(11) : "",
          service: (appt?.serviceName as string) ?? "",
          course: (ctx.lead?.courseName as string) ?? "CASTEL STUDIO ACADEMY",
        },
        scheduledFor: a.delayHours ? new Date(Date.now() + a.delayHours * 3600_000) : null,
        automationRunId: runId,
      });
      return { action: a.type, ok: true, detail: `message ${m.id} → ${m.status}${m.error ? ` (${m.error})` : ""}` };
    }
    case "task.create": {
      const who = (ctx.customer?.name as string) ?? (ctx.lead?.name as string) ?? "";
      const link = ctx.customer ? `/crm/${ctx.customer.id}` : ctx.lead ? "/academy/leads" : null;
      const t = await db.task.create({
        data: {
          businessId,
          title: who ? `${a.title} — ${who}` : a.title,
          details: link,
          priority: a.priority,
          dueAt: addDays(startOfDay(), a.dueInDays),
          source: "automation",
        },
      });
      return { action: a.type, ok: true, detail: `task ${t.id}` };
    }
    case "notify": {
      await db.notification.create({ data: { businessId, kind: "automation", level: a.level, title: a.title, body: a.body ?? null, link: "/automations" } });
      return { action: a.type, ok: true };
    }
    case "customer.tag": {
      if (!ctx.customer) return { action: a.type, ok: true, detail: "skipped: no customer" };
      const c = await db.customer.findUnique({ where: { id: ctx.customer.id }, select: { tags: true } });
      if (c && !c.tags.includes(a.tag)) await db.customer.update({ where: { id: ctx.customer.id }, data: { tags: { push: a.tag } } });
      return { action: a.type, ok: true, detail: a.tag };
    }
    case "lead.schedule_followup": {
      if (!ctx.lead) return { action: a.type, ok: true, detail: "skipped: no lead" };
      await db.lead.update({ where: { id: ctx.lead.id }, data: { nextFollowUpAt: addDays(startOfDay(), a.inDays) } });
      return { action: a.type, ok: true };
    }
    case "approval.request": {
      const subject = ctx.campaign ?? ctx.customer ?? ctx.lead;
      const req = await db.approvalRequest.create({
        data: {
          businessId,
          kind: ctx.campaign ? "content.publish" : "message.send",
          title: `${a.title}${subject?.name ? ` — ${subject.name}` : ""}`,
          payload: { automation: automation.name, context: JSON.parse(JSON.stringify(subject ?? {})) },
          requestedByAgent: "automation",
        },
      });
      return { action: a.type, ok: true, detail: `approval ${req.id}` };
    }
    case "report.weekly": {
      const m = await getDashboardMetrics(businessId);
      const lastWeekStart = addDays(startOfDay(), -7);
      const [txs, appts, newCustomers, leads] = await Promise.all([
        db.transaction.findMany({ where: { businessId, kind: "ACTUAL", occurredAt: { gte: lastWeekStart } }, select: { type: true, amount: true } }),
        db.appointment.groupBy({ by: ["status"], where: { businessId, startsAt: { gte: lastWeekStart, lt: new Date() } }, _count: true }),
        db.customer.count({ where: { businessId, createdAt: { gte: lastWeekStart } } }),
        db.lead.count({ where: { businessId, createdAt: { gte: lastWeekStart } } }),
      ]);
      const income = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + toNumber(t.amount), 0);
      const expense = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + toNumber(t.amount), 0);
      const done = appts.find((x) => x.status === "COMPLETED")?._count ?? 0;
      const noShow = appts.find((x) => x.status === "NO_SHOW")?._count ?? 0;
      const body = [
        `הכנסות בפועל (7 ימים): ${formatILS(income)} · הוצאות: ${formatILS(expense)} · נטו: ${formatILS(income - expense)}`,
        `תורים שהושלמו: ${done} · אי-הגעות: ${noShow} · לקוחות חדשים: ${newCustomers} · לידים חדשים: ${leads}`,
        `החודש עד כה: הכנסות ${formatILS(m.revenueMonth)}, רווח נקי ${formatILS(m.netMonth)}${m.marginMonth !== null ? ` (${m.marginMonth}%)` : ""}`,
      ].join("\n");
      await db.notification.create({ data: { businessId, kind: "report", level: "info", title: "דוח ביצועים שבועי", body, link: "/finance" } });
      return { action: a.type, ok: true };
    }
  }
}

/**
 * Run one automation for one context. Idempotent per (automation, dedupeKey).
 * Failures are recorded and scheduled for retry with exponential backoff.
 */
export async function runAutomation(automation: Automation, ctx: RunContext, dedupeKey?: string | null, attempt = 1) {
  const parsed = definitionSchema.safeParse(automation.definition);
  if (!parsed.success) {
    logger.error("automation.invalid_definition", { automationId: automation.id });
    return null;
  }
  let run;
  try {
    run = await db.automationRun.create({
      data: { automationId: automation.id, businessId: automation.businessId, status: "running", attempt, dedupeKey: dedupeKey ?? null, input: JSON.parse(JSON.stringify(ctx)) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null; // already processed
    throw e;
  }
  return executeRun(automation, run.id, ctx, attempt);
}

async function executeRun(automation: Automation, runId: string, ctx: RunContext, attempt: number) {
  const def = definitionSchema.parse(automation.definition);
  const cond = evaluateConditions(def.conditions, ctx);
  if (!cond.pass) {
    await db.automationRun.update({
      where: { id: runId },
      data: { status: "skipped", finishedAt: new Date(), output: { reason: "conditions", failed: cond.failed } as Prisma.InputJsonValue },
    });
    return "skipped";
  }
  const steps: StepLog[] = [];
  try {
    for (const action of def.actions) steps.push(await executeAction(action, automation, ctx, runId));
    await db.automationRun.update({ where: { id: runId }, data: { status: "succeeded", steps, finishedAt: new Date(), error: null, nextRetryAt: null } });
    await db.automation.update({ where: { id: automation.id }, data: { lastRunAt: new Date() } });
    return "succeeded";
  } catch (e) {
    const willRetry = attempt < automation.maxRetries;
    steps.push({ action: "error", ok: false, detail: String(e).slice(0, 300) });
    await db.automationRun.update({
      where: { id: runId },
      data: { status: willRetry ? "retrying" : "failed", steps, error: String(e).slice(0, 1000), finishedAt: new Date(), nextRetryAt: willRetry ? new Date(Date.now() + retryDelayMs(attempt)) : null },
    });
    logger.error("automation.run_failed", { automationId: automation.id, runId, attempt, err: String(e) });
    if (!willRetry) {
      await db.notification.create({ data: { businessId: automation.businessId, kind: "automation", level: "warn", title: `אוטומציה נכשלה: ${automation.name}`, body: String(e).slice(0, 300), link: "/automations" } });
    }
    return "failed";
  }
}

/** Re-run failed runs whose retry time has come. Steps are re-executed from the start. */
export async function processRetries(limit = 20) {
  const due = await db.automationRun.findMany({ where: { status: "retrying", nextRetryAt: { lte: new Date() } }, include: { automation: true }, take: limit });
  for (const r of due) {
    const attempt = r.attempt + 1;
    await db.automationRun.update({ where: { id: r.id }, data: { status: "running", attempt, nextRetryAt: null } });
    await executeRun(r.automation, r.id, (r.input ?? {}) as RunContext, attempt);
  }
  return due.length;
}

/** Fire an event trigger. Never throws into the caller's business operation. */
export async function emitEvent(businessId: string, trigger: TriggerKey, ctx: RunContext) {
  try {
    const autos = await db.automation.findMany({ where: { businessId, trigger, isActive: true } });
    for (const a of autos) {
      const subjectId = ctx.appointment?.id ?? ctx.lead?.id ?? ctx.campaign?.id ?? ctx.customer?.id ?? null;
      await runAutomation(a, ctx, subjectId ? `${trigger}:${subjectId}` : null);
    }
  } catch (e) {
    logger.error("automation.emit_failed", { trigger, err: String(e) });
  }
}

/** Context builders shared by events and schedules. */
export function customerCtx(c: { id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null; status: string; tags: string[]; visitCount: number; source: string | null; marketingConsentWhatsapp: string; marketingConsentEmail: string; marketingConsentSms: string }) {
  return {
    id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), phone: c.phone, email: c.email, status: c.status, tags: c.tags,
    visitCount: c.visitCount, source: c.source, consentWhatsapp: c.marketingConsentWhatsapp, consentEmail: c.marketingConsentEmail, consentSms: c.marketingConsentSms,
  };
}

/** Daily scheduler entry (Vercel Cron). Safe to run more than once a day thanks to dedupe keys. */
export async function runScheduled(now = new Date(), opts: { businessId?: string; automationId?: string } = {}) {
  const summary: Record<string, number> = {};
  const autos = await db.automation.findMany({
    where: { isActive: true, trigger: { startsWith: "schedule." }, ...(opts.businessId ? { businessId: opts.businessId } : {}), ...(opts.automationId ? { id: opts.automationId } : {}) },
  });
  const today = startOfDay(now);
  const p = zonedParts(now);
  const dayKey = `${p.year}-${p.month}-${p.day}`;
  for (const a of autos) {
    let count = 0;
    if (a.trigger === "schedule.appointment_reminder") {
      const appts = await db.appointment.findMany({
        where: { businessId: a.businessId, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { gte: addDays(today, 1), lt: addDays(today, 2) }, customerId: { not: null } },
        include: { customer: true, service: true },
      });
      for (const ap of appts) {
        const r = await runAutomation(a, { customer: customerCtx(ap.customer!), appointment: { id: ap.id, startsAt: ap.startsAt, serviceName: ap.service?.nameHe ?? "", status: ap.status } }, `appt:${ap.id}`);
        if (r) count++;
      }
    } else if (a.trigger === "schedule.birthday") {
      const customers = await db.customer.findMany({ where: { businessId: a.businessId, archivedAt: null, birthday: { not: null } } });
      for (const c of customers.filter((c) => upcomingBirthday(c.birthday, now, 0) === 0)) {
        const r = await runAutomation(a, { customer: customerCtx(c) }, `bday:${c.id}:${p.year}`);
        if (r) count++;
      }
    } else if (a.trigger === "schedule.lead_followup") {
      const leads = await db.lead.findMany({ where: { businessId: a.businessId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] }, nextFollowUpAt: { lte: now } }, include: { course: true } });
      for (const l of leads) {
        const r = await runAutomation(a, { lead: { id: l.id, name: l.name, status: l.status, kind: l.kind, source: l.source, courseName: l.course?.nameHe ?? null } }, `followup:${l.id}:${dayKey}`);
        if (r) count++;
      }
    } else if (a.trigger === "schedule.weekly_report") {
      if (p.weekday === 0) {
        const r = await runAutomation(a, {}, `week:${dayKey}`);
        if (r) count++;
      }
    }
    summary[a.trigger] = (summary[a.trigger] ?? 0) + count;
  }
  return summary;
}

export function isScheduleTrigger(t: string) {
  return (TRIGGERS as Record<string, { kind: string }>)[t]?.kind === "schedule";
}
