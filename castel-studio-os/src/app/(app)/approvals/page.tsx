import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { decideApprovalAction } from "@/server/actions/approvals";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Input, Notice, PageHeader } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const { user, t, locale, allowed } = await pageGuard("approvals.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const items = await db.approvalRequest.findMany({
    where: { businessId: user.businessId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
  });
  const decide = can(user.role, "approvals.decide");
  const tone = { PENDING: "gold", APPROVED: "success", REJECTED: "danger", EXECUTED: "success", FAILED: "danger" } as const;
  return (
    <>
      <PageHeader title={t.approvals.title} subtitle={t.approvals.subtitle} />
      <Notice tone="neutral" className="mb-4">{t.approvals.noExecutor}</Notice>
      {items.length === 0 ? <EmptyState title={t.common.empty} /> : (
        <div className="space-y-3">
          {items.map((a) => {
            const p = a.payload as Record<string, unknown>;
            return (
              <Card key={a.id} className={a.status === "PENDING" ? "border-gold/40" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={tone[a.status]}>{t.approvalStatus[a.status]}</Badge><Badge>{a.kind}</Badge>{a.requestedByAgent && <Badge tone="info">{t.agents[a.requestedByAgent as keyof typeof t.agents] ?? a.requestedByAgent}</Badge>}</div>
                    <h3 className="mt-2 font-semibold">{a.title}</h3>
                    <p className="text-[11px] text-muted">{t.approvals.requestedBy}: {a.requestedBy?.name ?? "—"} · {formatDateTime(a.createdAt, locale)}</p>
                  </div>
                  {decide && a.status === "PENDING" && (
                    <form action={decideApprovalAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <Input name="note" placeholder={t.approvals.note} className="h-8 w-48 text-xs" />
                      <button name="decision" value="approve" className="h-8 rounded-lg bg-success/15 px-3 text-xs text-success hover:bg-success/25">{t.approvals.approve}</button>
                      <button name="decision" value="reject" className="h-8 rounded-lg bg-danger/15 px-3 text-xs text-danger hover:bg-danger/25">{t.approvals.reject}</button>
                    </form>
                  )}
                </div>
                <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
                  {typeof p.details === "string" && <p className="whitespace-pre-wrap">{p.details}</p>}
                  {typeof p.body === "string" && <p className="whitespace-pre-wrap">{p.body}</p>}
                  {Array.isArray(p.recipientIds) && <p className="mt-2 text-xs text-muted">{p.channel as string} · {p.recipientIds.length} recipients (opted-in only)</p>}
                </div>
                {a.decidedAt && <p className="mt-2 text-[11px] text-muted">{t.approvals.decided}: {a.decidedBy?.name} · {formatDateTime(a.decidedAt, locale)}{a.decisionNote ? ` — ${a.decisionNote}` : ""}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
