import Link from "next/link";
import { Play, Plus, RefreshCw, Workflow } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { TRIGGERS, type TriggerKey } from "@/server/automation/definition";
import { ensureBuiltinAutomations } from "@/server/automation/defaults";
import { runAutomationNowAction, runMaintenanceAction, toggleAutomationAction } from "@/server/actions/automation";
import { InlineAction } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Notice, PageHeader, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Automations" };
export const dynamic = "force-dynamic";

const runTone = { succeeded: "success", skipped: "neutral", failed: "danger", retrying: "warning", running: "info" } as const;

export default async function AutomationsPage() {
  const { user, locale, t, allowed } = await pageGuard("automations.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  await ensureBuiltinAutomations(db, user.businessId);
  const [autos, runs, stats] = await Promise.all([
    db.automation.findMany({ where: { businessId: user.businessId }, orderBy: [{ key: "asc" }, { createdAt: "asc" }], include: { _count: { select: { runs: true } } } }),
    db.automationRun.findMany({ where: { businessId: user.businessId }, orderBy: { startedAt: "desc" }, take: 40, include: { automation: { select: { name: true } } } }),
    db.automationRun.groupBy({ by: ["status"], where: { businessId: user.businessId, startedAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true }),
  ]);
  const edit = can(user.role, "automations.edit");
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0;
  const cronReady = Boolean(process.env.CRON_SECRET?.trim());

  return (
    <>
      <PageHeader
        title={t.nav.automations}
        subtitle={L("טריגרים, תנאים ופעולות — כל הודעה ללקוח ממתינה לאישורך במרכז התקשורת", "Triggers, conditions and actions — every customer message waits for your approval in Communications")}
        actions={edit && (
          <>
            <InlineAction action={runMaintenanceAction} variant="secondary" size="md"><RefreshCw size={14} /> {L("עיבוד ניסיונות חוזרים ותור", "Process retries & queue")}</InlineAction>
            <Link href="/automations/new" className={buttonClass()}><Plus size={14} /> {L("אוטומציה חדשה", "New automation")}</Link>
          </>
        )}
      />
      {!cronReady && (
        <Notice tone="warning" className="mb-4">
          {L("התזמון היומי (תזכורות, ימי הולדת, מעקב לידים, דוח שבועי) רץ אוטומטית רק כשמוגדר משתנה הסביבה CRON_SECRET ב-Vercel. עד אז אפשר להריץ ידנית עם \"הרץ עכשיו\".",
             "The daily schedule (reminders, birthdays, lead follow-ups, weekly report) runs automatically only once the CRON_SECRET env var is set in Vercel. Until then, use \"Run now\".")}
        </Notice>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={L("אוטומציות פעילות", "Active automations")} value={`${autos.filter((a) => a.isActive).length}/${autos.length}`} />
        <Stat label={L("הצליחו (30 יום)", "Succeeded (30d)")} value={count("succeeded")} />
        <Stat label={L("דולגו לפי תנאים", "Skipped by conditions")} value={count("skipped")} />
        <Stat label={L("נכשלו / בניסיון חוזר", "Failed / retrying")} value={`${count("failed")} / ${count("retrying")}`} />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {autos.map((a) => {
          const trig = TRIGGERS[a.trigger as TriggerKey];
          return (
            <Card key={a.id} className={`p-4 ${a.isActive ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={a.isActive ? "success" : "neutral"}>{a.isActive ? L("פעיל", "Active") : L("כבוי", "Off")}</Badge>
                    <Badge tone={trig?.kind === "schedule" ? "info" : "gold"}>{trig ? (locale === "he" ? trig.he : trig.en) : a.trigger}</Badge>
                    {a.key && <Badge>{L("מובנה", "Built-in")}</Badge>}
                  </div>
                  <h3 className="mt-2 font-semibold">{a.name}</h3>
                  {a.description && <p className="mt-1 text-xs leading-relaxed text-muted">{a.description}</p>}
                </div>
                <Workflow size={18} className="shrink-0 text-gold/70" />
              </div>
              <p className="mt-3 text-[11px] text-muted">{L("ריצה אחרונה", "Last run")}: {a.lastRunAt ? formatDateTime(a.lastRunAt, locale) : "—"} · {a._count.runs} {L("ריצות", "runs")}</p>
              {edit && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <InlineAction action={toggleAutomationAction} fields={{ id: a.id }} variant={a.isActive ? "secondary" : "primary"}>{a.isActive ? L("השבתה", "Deactivate") : L("הפעלה", "Activate")}</InlineAction>
                  {trig?.kind === "schedule" && <InlineAction action={runAutomationNowAction} fields={{ id: a.id }} variant="outline"><Play size={12} /> {L("הרץ עכשיו", "Run now")}</InlineAction>}
                  <Link href={`/automations/${a.id}`} className={buttonClass("ghost", "sm")}>{t.common.edit}</Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>{L("יומן ריצות", "Execution log")}</CardTitle>
        {runs.length ? (
          <Table>
            <thead><tr><Th>{t.audit.when}</Th><Th>{L("אוטומציה", "Automation")}</Th><Th>{t.common.status}</Th><Th>{L("ניסיון", "Attempt")}</Th><Th>{L("צעדים", "Steps")}</Th></tr></thead>
            <tbody>
              {runs.map((r) => {
                const steps = (Array.isArray(r.steps) ? r.steps : []) as { action: string; ok: boolean; detail?: string }[];
                return (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs tabular-nums text-muted">{formatDateTime(r.startedAt, locale)}</Td>
                    <Td className="text-sm">{r.automation.name}</Td>
                    <Td><Badge tone={runTone[r.status as keyof typeof runTone] ?? "neutral"}>{r.status}</Badge>{r.nextRetryAt && <span className="ms-1 text-[10px] text-muted">→ {formatDateTime(r.nextRetryAt, locale)}</span>}</Td>
                    <Td className="tabular-nums">{r.attempt}</Td>
                    <Td className="max-w-md text-[11px] text-muted" dir="ltr">
                      {steps.map((s, i) => <div key={i} className={s.ok ? "" : "text-danger"}>{s.ok ? "✓" : "✕"} {s.action}{s.detail ? ` — ${s.detail}` : ""}</div>)}
                      {r.status === "skipped" && <div>{L("תנאים לא התקיימו", "conditions not met")}</div>}
                      {r.error && !steps.length && <div className="text-danger">{r.error.slice(0, 160)}</div>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState title={t.common.empty} />}
      </Card>
    </>
  );
}
