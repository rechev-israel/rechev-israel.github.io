import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarX, Clock, Bell } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/comms";
import { notificationWhere, canSeeBookingNotifications } from "@/server/notify/visibility";
import { vapidPublicKey } from "@/server/notify/push";
import { PushSettings } from "@/components/shell/push-settings";
import { InlineAction } from "@/components/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const FILTERS = ["all", "booking_created", "booking_pending", "booking_cancelled", "booking_rescheduled", "other"] as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ type?: string; unread?: string }> }) {
  const { user, locale } = await pageGuard();
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const sp = await searchParams;
  const type = (FILTERS as readonly string[]).includes(sp.type ?? "") ? (sp.type as (typeof FILTERS)[number]) : "all";
  const unreadOnly = sp.unread === "1";
  const kindFilter = type === "all" ? {} : type === "other" ? { NOT: { kind: { startsWith: "booking_" } } } : { kind: type };
  const base = notificationWhere(user);
  const [items, counts, devices] = await Promise.all([
    db.notification.findMany({ where: { AND: [base, kindFilter, unreadOnly ? { readAt: null } : {}] }, orderBy: { createdAt: "desc" }, take: 150 }),
    db.notification.groupBy({ by: ["kind"], where: { ...base, readAt: null }, _count: true }),
    db.pushSubscription.count({ where: { userId: user.id } }),
  ]);
  const unreadBy = Object.fromEntries(counts.map((c) => [c.kind, c._count]));
  const totalUnread = counts.reduce((s, c) => s + c._count, 0);
  const label: Record<(typeof FILTERS)[number], string> = {
    all: L("הכל", "All"), booking_created: L("תורים חדשים", "New bookings"), booking_pending: L("ממתינים לאישור", "Pending"),
    booking_cancelled: L("ביטולים", "Cancellations"), booking_rescheduled: L("הזזות", "Rescheduled"), other: L("מערכת", "System"),
  };
  const icon = (k: string) => k === "booking_created" ? <CalendarCheck size={16} /> : k === "booking_cancelled" ? <CalendarX size={16} /> : k === "booking_rescheduled" ? <CalendarClock size={16} /> : k === "booking_pending" ? <Clock size={16} /> : <Bell size={16} />;
  const tone = (k: string) => k === "booking_cancelled" ? "text-danger bg-danger/10" : k === "booking_pending" ? "text-warning bg-warning/10" : k.startsWith("booking") ? "text-gold bg-gold/10" : "text-muted bg-surface-2";
  const q = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(); const v = { type, unread: unreadOnly ? "1" : undefined, ...o }; for (const [k, x] of Object.entries(v)) if (x && !(k === "type" && x === "all")) p.set(k, x); const s = p.toString(); return s ? `/notifications?${s}` : "/notifications"; };

  return (
    <>
      <PageHeader title={L("מרכז התראות", "Notification center")} subtitle={L("כל תור חדש, ביטול והזזה נרשם כאן אוטומטית.", "Every new booking, cancellation and reschedule is logged here automatically.")}
        actions={totalUnread > 0 && <InlineAction action={markNotificationsReadAction} variant="secondary" size="md">{L("סימון הכל כנקרא", "Mark all read")} ({totalUnread})</InlineAction>} />
      {canSeeBookingNotifications(user.role) && <div className="mb-4"><PushSettings vapidKey={vapidPublicKey()} devices={devices} he={he} /></div>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.filter((f) => canSeeBookingNotifications(user.role) || f === "all" || f === "other").map((f) => {
          const n = f === "all" ? totalUnread : f === "other" ? Object.entries(unreadBy).filter(([k]) => !k.startsWith("booking_")).reduce((s, [, c]) => s + c, 0) : unreadBy[f] ?? 0;
          return <Link key={f} href={q({ type: f })} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${type === f ? "border-gold bg-gold/15 text-gold" : "border-border text-muted hover:text-text"}`}>{label[f]}{n > 0 && <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{n}</span>}</Link>;
        })}
        <Link href={q({ unread: unreadOnly ? undefined : "1" })} className={`ms-auto inline-flex h-9 items-center rounded-full border px-3 text-sm ${unreadOnly ? "border-gold text-gold" : "border-border text-muted"}`}>{L("רק שלא נקראו", "Unread only")}</Link>
      </div>
      {items.length === 0 ? <EmptyState title={L("אין התראות", "No notifications")} /> : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={`p-0 ${n.readAt ? "opacity-70" : "border-gold/40"}`}>
              <div className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone(n.kind)}`}>{icon(n.kind)}</span>
                <a href={`/api/notifications/${n.id}/open`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{n.title}</p>
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-gold" aria-label={L("לא נקרא", "Unread")} />}
                  </div>
                  {n.body && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{n.body}</p>}
                  <p className="mt-2 text-[11px] text-muted">{L("נוצרה", "Created")}: {formatDateTime(n.createdAt, locale)}{n.link ? ` · ${L("לחיצה פותחת את התור", "Tap to open")}` : ""}</p>
                </a>
                {!n.readAt && <InlineAction action={markNotificationsReadAction} fields={{ id: n.id }}>✓</InlineAction>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
