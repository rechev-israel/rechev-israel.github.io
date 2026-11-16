import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { convertLeadAction, leadStatusAction } from "@/server/actions/academy";
import { InlineAction } from "@/components/forms";
import { AutoSubmitSelect } from "@/components/academy/auto-submit-select";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

const COLS = ["NEW", "CONTACTED", "QUALIFIED", "ENROLLED", "LOST"] as const;

export default async function LeadsPage() {
  const { user, t, locale, allowed } = await pageGuard("academy.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const leads = await db.lead.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "desc" }, include: { course: true } });
  const edit = can(user.role, "academy.edit");
  return (
    <>
      <Link href="/academy" className="mb-2 inline-flex min-h-9 items-center text-xs text-muted hover:text-gold">← {t.academy.title}</Link>
      <PageHeader title={t.academy.pipeline} subtitle={`${t.academy.landing}: /join`} />
      {leads.length === 0 ? <EmptyState title={t.common.empty} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {COLS.map((col) => {
            const list = leads.filter((l) => l.status === col);
            return (
              <div key={col} className="rounded-xl border border-border bg-surface/60 p-2">
                <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold">{t.leadStatus[col]} <Badge>{list.length}</Badge></p>
                <div className="space-y-2">
                  {list.map((l) => (
                    <Card key={l.id} className="p-3 text-xs">
                      <p className="text-sm font-medium">{l.name}</p>
                      <p className="text-muted" dir="ltr">{l.phone ?? l.email ?? "—"}</p>
                      {l.course && <Badge tone="gold" className="mt-1">{l.course.code}</Badge>}
                      {l.message && <p className="mt-1 line-clamp-3 text-muted">{l.message}</p>}
                      <p className="mt-1 text-[10px] text-muted">{formatDateTime(l.createdAt, locale)} · {l.source ?? ""}</p>
                      {edit && (
                        <div className="mt-2 space-y-1">
                          <AutoSubmitSelect action={leadStatusAction} fields={{ id: l.id }} name="status" value={l.status} label={t.common.status} options={COLS.map((c) => ({ value: c, label: t.leadStatus[c] }))} />
                          {(l.status === "NEW" || l.status === "CONTACTED") && <InlineAction action={convertLeadAction} fields={{ id: l.id }} variant="outline" className="w-full">{t.academy.convert}</InlineAction>}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
