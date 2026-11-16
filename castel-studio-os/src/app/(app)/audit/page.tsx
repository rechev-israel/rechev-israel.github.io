import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Audit" };

export default async function AuditPage() {
  const { user, t, locale, allowed } = await pageGuard("audit.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const logs = await db.auditLog.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { name: true } } } });
  return (
    <>
      <PageHeader title={t.audit.title} />
      <Card className="p-4">
        {logs.length ? (
          <Table>
            <thead><tr><Th>{t.audit.when}</Th><Th>{t.audit.user}</Th><Th>{t.audit.action}</Th><Th>{t.audit.entity}</Th><Th>meta</Th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs tabular-nums text-muted">{formatDateTime(l.createdAt, locale)}</Td>
                  <Td className="text-xs">{l.user?.name ?? "system"}</Td>
                  <Td><code className="text-xs text-gold" dir="ltr">{l.action}</code></Td>
                  <Td className="text-xs text-muted" dir="ltr">{l.entityType}{l.entityId ? `:${l.entityId.slice(-6)}` : ""}</Td>
                  <Td className="max-w-xs truncate text-[11px] text-muted" dir="ltr">{l.metadata ? JSON.stringify(l.metadata) : ""}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title={t.common.empty} />}
      </Card>
    </>
  );
}
