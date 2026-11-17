import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/comms";
import { InlineAction } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user, locale } = await pageGuard();
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const items = await db.notification.findMany({
    where: { businessId: user.businessId, OR: [{ userId: null }, { userId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title={L("התראות", "Notifications")} actions={items.some((n) => !n.readAt) && <InlineAction action={markNotificationsReadAction} variant="secondary" size="md">{L("סימון הכל כנקרא", "Mark all read")}</InlineAction>} />
      {items.length === 0 ? <EmptyState title={L("אין התראות", "No notifications")} /> : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={`p-4 ${n.readAt ? "opacity-60" : "border-gold/40"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <Badge tone={n.level === "warn" ? "warning" : n.level === "success" ? "success" : "info"}>{n.kind}</Badge>
                    <span className="text-muted">{formatDateTime(n.createdAt, locale)}</span>
                  </div>
                  <p className="mt-1 font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{n.body}</p>}
                  {n.link && <Link href={n.link} className="mt-1 inline-block text-xs text-gold underline">{L("פתיחה", "Open")}</Link>}
                </div>
                {!n.readAt && <InlineAction action={markNotificationsReadAction} fields={{ id: n.id }}>✓</InlineAction>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
