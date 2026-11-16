import { pageGuard } from "@/server/auth/guard";
import { getIntegrationStatuses } from "@/server/integrations/registry";
import { formatDateTime } from "@/lib/utils";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { user, t, locale, allowed } = await pageGuard("integrations.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const list = await getIntegrationStatuses(user.businessId);
  const tone = { CONNECTED: "success", NOT_CONFIGURED: "neutral", REQUIRES_AUTHORIZATION: "warning", ERROR: "danger" } as const;
  const counts = list.reduce<Record<string, number>>((acc, i) => ((acc[i.live.status] = (acc[i.live.status] ?? 0) + 1), acc), {});
  return (
    <>
      <PageHeader title={t.integrations.title} subtitle={t.integrations.subtitle} actions={<a href="/integrations" className={buttonClass("secondary")}>{t.integrations.check}</a>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["CONNECTED", "NOT_CONFIGURED", "REQUIRES_AUTHORIZATION", "ERROR"] as const).map((s) => <Badge key={s} tone={tone[s]} className="h-7 px-3">{t.integrations[s]}: {counts[s] ?? 0}</Badge>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((i) => (
          <Card key={i.provider} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{i.name}</h3>
                <p className="text-[11px] uppercase tracking-wide text-muted">{i.category} · {t.integrations.phase} {i.phase}</p>
              </div>
              <Badge tone={tone[i.live.status]}>{t.integrations[i.live.status]}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{locale === "he" ? i.docsHe : i.docsEn}</p>
            {i.envVars.length > 0 && <p className="mt-2 text-[11px] text-muted">{t.integrations.envVar}: <code dir="ltr" className="rounded bg-surface-2 px-1.5 py-0.5 text-gold">{i.envVars.join(", ")}</code></p>}
            {i.live.detail && <Notice tone={i.live.status === "ERROR" ? "danger" : "neutral"} className="mt-2">{i.live.detail}</Notice>}
          </Card>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted">{t.integrations.lastCheck}: {formatDateTime(new Date(), locale)}</p>
    </>
  );
}
