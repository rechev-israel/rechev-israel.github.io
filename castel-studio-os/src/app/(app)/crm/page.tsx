import Link from "next/link";
import { Cake, Download, Plus, RefreshCw, Search } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { listCustomers } from "@/server/services/crm";
import { recomputeSegmentsAction } from "@/server/actions/crm";
import { db } from "@/lib/db";
import { formatDate, formatILS, fullName } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { InlineAction } from "@/components/forms";
import { Forbidden } from "@/components/forbidden";
import { segmentTone } from "@/components/crm/customer-fields";

export const metadata = { title: "CRM" };

export default async function CrmPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, t, locale, allowed } = await pageGuard("crm.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const { items, total, pages } = await listCustomers(user.businessId, { q: sp.q, segment: sp.segment, page, sort: sp.sort });
  const counts = await db.customer.groupBy({ by: ["status"], where: { businessId: user.businessId, archivedAt: null }, _count: true });
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, segment: sp.segment, sort: sp.sort, page: String(page), ...patch };
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return `/crm?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={t.crm.title}
        subtitle={t.crm.subtitle}
        actions={
          <>
            {can(user.role, "crm.edit") && <InlineAction action={recomputeSegmentsAction} variant="secondary" size="md"><RefreshCw size={14} /> {t.crm.recompute}</InlineAction>}
            <Link href="/crm/birthdays" className={buttonClass("secondary")}><Cake size={14} /> {t.crm.birthdayCampaign}</Link>
            <a href="/api/crm/export" className={buttonClass("secondary")}><Download size={14} /> {t.common.exportCsv}</a>
            {can(user.role, "crm.edit") && <Link href="/crm/new" className={buttonClass("primary")}><Plus size={14} /> {t.crm.new}</Link>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={qs({ segment: undefined, page: 1 })} className={buttonClass(!sp.segment ? "outline" : "ghost", "sm")}>{t.common.all} ({counts.reduce((s, c) => s + c._count, 0)})</Link>
        {(["VIP", "ACTIVE", "AT_RISK", "LAPSED", "BLOCKED"] as const).map((s) => (
          <Link key={s} href={qs({ segment: s, page: 1 })} className={buttonClass(sp.segment === s ? "outline" : "ghost", "sm")}>
            {t.segments[s]} ({countOf(s)})
          </Link>
        ))}
      </div>

      <Card className="p-4">
        <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/crm">
          {sp.segment && <input type="hidden" name="segment" value={sp.segment} />}
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={sp.q} placeholder={t.crm.searchPh} className="ps-9" />
          </div>
          <Select name="sort" defaultValue={sp.sort ?? ""} className="sm:w-44">
            <option value="">{t.common.createdAt}</option>
            <option value="name">{t.common.name}</option>
            <option value="lastVisit">{t.crm.lastVisit}</option>
            <option value="spent">{t.crm.spent}</option>
          </Select>
          <Button type="submit" variant="secondary">{t.common.search}</Button>
        </form>

        {items.length === 0 ? (
          <EmptyState title={t.common.empty} />
        ) : (
          <>
          {/* Phone: card list */}
          <ul className="space-y-2 md:hidden">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/crm/${c.id}`} className="block rounded-xl border border-border bg-surface-2 p-3 active:bg-surface-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{fullName(c)}</p>
                      <p className="text-xs text-muted" dir="ltr">{c.phone ?? "—"}</p>
                    </div>
                    <Badge tone={segmentTone(c.status)}>{t.segments[c.status]}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted">
                    <span>{t.crm.visits}: <b className="text-text">{c.visitCount}</b></span>
                    <span>{formatILS(c.totalSpent, locale)}</span>
                    <span className="text-end">{formatDate(c.lastVisitAt, locale)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {/* Tablet & desktop: sortable table */}
          <div className="hidden md:block">
          <Table>
            <thead>
              <tr>
                <Th>{t.common.name}</Th>
                <Th>{t.common.phone}</Th>
                <Th>{t.crm.segment}</Th>
                <Th>{t.crm.lastVisit}</Th>
                <Th className="text-end">{t.crm.visits}</Th>
                <Th className="text-end">{t.crm.spent}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/60">
                  <Td>
                    <Link href={`/crm/${c.id}`} className="font-medium hover:text-gold">{fullName(c)}</Link>
                    {c.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.tags.slice(0, 3).map((tg) => <Badge key={tg}>{tg}</Badge>)}</div>}
                  </Td>
                  <Td dir="ltr" className="text-muted tabular-nums">{c.phone ?? "—"}</Td>
                  <Td><Badge tone={segmentTone(c.status)}>{t.segments[c.status]}</Badge></Td>
                  <Td className="text-muted">{formatDate(c.lastVisitAt, locale)}</Td>
                  <Td className="text-end tabular-nums">{c.visitCount}</Td>
                  <Td className="text-end tabular-nums">{formatILS(c.totalSpent, locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </div>
          </>
        )}
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>{total} · {page}/{pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className={buttonClass("secondary", "sm")} href={qs({ page: page - 1 })}>‹</Link>}
              {page < pages && <Link className={buttonClass("secondary", "sm")} href={qs({ page: page + 1 })}>›</Link>}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
