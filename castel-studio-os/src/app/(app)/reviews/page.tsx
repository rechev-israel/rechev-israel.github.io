import Link from "next/link";
import { Star } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { setReviewStatusAction, deleteReviewAction } from "@/server/actions/reviews";
import { InlineAction } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "ביקורות" };
export const dynamic = "force-dynamic";

const Stars = ({ n, size = 15 }: { n: number; size?: number }) => (
  <span className="inline-flex gap-0.5" aria-label={`${n}/5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= n ? "fill-[var(--gold)] text-gold" : "text-border"} />)}</span>
);

/** Customer reviews left on the website. New reviews wait here until the owner publishes them. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("crm.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const edit = can(user.role, "services.edit");
  const sp = await searchParams;
  const tab = (["PENDING", "PUBLISHED", "HIDDEN"] as const).find((x) => x === sp.tab) ?? "PUBLISHED";
  const [items, counts, agg] = await Promise.all([
    db.review.findMany({ where: { businessId: user.businessId, status: tab }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.review.groupBy({ by: ["status"], where: { businessId: user.businessId }, _count: true }),
    db.review.aggregate({ where: { businessId: user.businessId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const appts = await db.appointment.findMany({ where: { id: { in: items.map((r) => r.appointmentId).filter((x): x is string => !!x) } }, select: { id: true, startsAt: true, service: { select: { nameHe: true } } } });
  const TABS = [["PUBLISHED", L("מפורסמות באתר", "Published")], ["HIDDEN", L("מוסתרות", "Hidden")], ...(count("PENDING") ? [["PENDING", L("ממתינות", "Pending")] as const] : [])] as const;
  return (
    <div className="space-y-5">
      <PageHeader title={L("ביקורות", "Reviews")} subtitle={L("ביקורות שלקוחות השאירו באתר. כל ביקורת עולה לאתר מיד. אפשר להסתיר או למחוק ביקורת בכל רגע.", "Reviews customers left on the website. Each review goes live immediately; you can hide or delete any of them.")} />
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="font-display text-4xl font-bold text-gold">{agg._avg.rating ? agg._avg.rating.toFixed(1) : "—"}</div>
        <div><Stars n={Math.round(agg._avg.rating ?? 0)} size={18} /><p className="text-xs text-muted">{L(`${agg._count} ביקורות מפורסמות`, `${agg._count} published reviews`)}</p></div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/reviews?tab=${k}`} className={`rounded-full border px-3.5 py-1.5 text-sm ${tab === k ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`}>{label} · {count(k)}</Link>
        ))}
      </div>
      {!items.length ? <EmptyState icon={<Star />} title={tab === "PUBLISHED" ? L("עדיין אין ביקורות", "No reviews yet") : L("אין כאן ביקורות", "Nothing here")}>{L("אחרי שלקוח קובע תור באתר הוא מוזמן להשאיר ביקורת. ביקורות חדשות יופיעו כאן.", "After booking, customers are invited to leave a review. New ones appear here.")}</EmptyState> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((r) => {
            const ap = appts.find((a) => a.id === r.appointmentId);
            return (
              <Card key={r.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.customerId ? <Link href={`/crm/${r.customerId}`} className="hover:text-gold">{r.name}</Link> : r.name}</p>
                    <p className="text-xs text-muted">{formatDate(r.createdAt, locale)}{ap ? ` · ${ap.service?.nameHe ?? ""} ${formatDate(ap.startsAt, locale)}` : ""}</p>
                  </div>
                  <Stars n={r.rating} />
                </div>
                {r.text ? <p className="whitespace-pre-line text-sm leading-relaxed">{r.text}</p> : <p className="text-sm text-muted">{L("(דירוג בלי טקסט)", "(rating only)")}</p>}
                {r.suggestion && <p className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><b className="text-muted">{L("הצעה לשיפור (פרטי):", "Improvement idea (private):")}</b> {r.suggestion}</p>}
                <div className="flex flex-wrap gap-1.5">{r.verified && <Badge tone="info">{L("אחרי ביקור", "Verified visit")}</Badge>}{!r.publicConsent && <Badge>{L("פרטי, לא מוצג באתר", "Private, not on site")}</Badge>}{r.serviceRating && <Badge>{L("שירות", "Service")} {r.serviceRating}★</Badge>}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge tone={r.status === "PUBLISHED" ? "success" : r.status === "HIDDEN" ? "neutral" : "warning"}>{r.status === "PUBLISHED" ? L("מפורסם באתר", "Published") : r.status === "HIDDEN" ? L("מוסתר", "Hidden") : L("ממתין לאישור", "Pending")}</Badge>
                  {edit && (<>
                    {r.status !== "PUBLISHED" && <InlineAction action={setReviewStatusAction} fields={{ id: r.id, status: "PUBLISHED" }} variant="primary">{L("פרסום באתר", "Publish")}</InlineAction>}
                    {r.status !== "HIDDEN" && <InlineAction action={setReviewStatusAction} fields={{ id: r.id, status: "HIDDEN" }}>{L("הסתרה", "Hide")}</InlineAction>}
                    <InlineAction action={deleteReviewAction} fields={{ id: r.id }} confirm={L("למחוק את הביקורת לצמיתות?", "Delete this review permanently?")} variant="danger">{L("מחיקה", "Delete")}</InlineAction>
                  </>)}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
