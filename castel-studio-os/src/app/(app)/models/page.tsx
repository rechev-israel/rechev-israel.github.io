import Link from "next/link";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/utils";
import { zonedParts } from "@/lib/dates";
import { getExperience } from "@/server/services/experience";
import { modelTick } from "@/server/services/model-applications";
import { approveModelAction, deleteModelPhotosAction, rejectModelAction, saveModelSettingsAction } from "@/server/actions/models";
import { ActionForm, InlineAction, SubmitButton } from "@/components/forms";
import { ContactButtons } from "@/components/contact-buttons";
import { Badge, Card, CardTitle, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "מודליסטים" };
export const dynamic = "force-dynamic";
const pad = (n: number) => String(n).padStart(2, "0");
const when = (d: Date) => { const p = zonedParts(d); return { date: `${pad(p.day)}.${pad(p.month)}.${p.year}`, time: `${pad(p.hour)}:${pad(p.minute)}` }; };

/** CASTEL MODEL EXPERIENCE — review hair-model applications. Nothing is confirmed until the owner approves. */
export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ tab?: string; app?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("bookings.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const isOwner = user.role === "OWNER";
  const canReview = user.role === "OWNER" || user.role === "MANAGER";
  const settingsEdit = can(user.role, "services.edit");
  await modelTick(user.businessId).catch(() => 0);
  const sp = await searchParams;
  const focus = sp.app ? await db.modelApplication.findFirst({ where: { id: sp.app, businessId: user.businessId }, select: { status: true } }) : null;
  const tab = (["pending", "approved", "closed"] as const).find((x) => x === sp.tab) ?? (focus ? (focus.status === "PENDING_APPROVAL" ? "pending" : focus.status === "APPROVED" ? "approved" : "closed") : "pending");
  const where = tab === "pending" ? { status: "PENDING_APPROVAL" } : tab === "approved" ? { status: "APPROVED" } : { status: { in: ["REJECTED", "ALT_PROPOSED", "CANCELLED", "EXPIRED"] } };
  const [apps, counts, cfg] = await Promise.all([
    db.modelApplication.findMany({ where: { businessId: user.businessId, ...where }, orderBy: tab === "closed" ? { updatedAt: "desc" } : { startsAt: "asc" }, take: 100 }),
    db.modelApplication.groupBy({ by: ["status"], where: { businessId: user.businessId }, _count: true }),
    getExperience(user.businessId),
  ]);
  const customers = await db.customer.findMany({ where: { id: { in: apps.map((a) => a.customerId) } }, select: { id: true, firstName: true, lastName: true, phone: true } });
  const cnt = (...s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  const ST: Record<string, [string, "warning" | "gold" | "danger" | "info" | "neutral"]> = {
    PENDING_APPROVAL: [L("ממתין לאישור שלך", "Awaiting your approval"), "warning"], APPROVED: [L("אושר", "Approved"), "gold"], REJECTED: [L("נדחה", "Rejected"), "danger"],
    ALT_PROPOSED: [L("הוצע מועד חלופי", "Alternative proposed"), "info"], CANCELLED: [L("בוטל", "Cancelled"), "neutral"], EXPIRED: [L("פג תוקף", "Expired"), "neutral"],
  };
  const photo = (id: string | null, label: string) => id ? (
    <a href={`/api/admin/photos/${id}`} target="_blank" rel="noopener" className="group block" aria-label={L(`הגדלת ${label}`, `Enlarge ${label}`)}>
      <img src={`/api/admin/photos/${id}`} alt={label} loading="lazy" className="aspect-[3/4] w-full rounded-xl border border-border object-cover transition group-hover:border-gold" />
      <span className="mt-1 block text-center text-[11px] text-muted">{label} · {L("להגדלה", "tap to enlarge")}</span>
    </a>
  ) : <div className="grid aspect-[3/4] place-items-center rounded-xl border border-dashed border-border text-[11px] text-muted">{L("נמחקה", "Deleted")}</div>;

  return (
    <div className="space-y-5">
      <PageHeader title={L("מודליסטים · CASTEL MODEL", "Hair models · CASTEL MODEL")} subtitle={L("בקשות של מודליסטים. שום בקשה לא הופכת לתור עד שאתה מאשר. מודליסט אחד בלבד בכל יום, שעתיים, ללא עלות.", "Hair-model applications. Nothing becomes an appointment until you approve. One model per day, two hours, free.")} />
      <nav className="flex flex-wrap gap-2">
        {([["pending", L("ממתינות לאישור", "Pending"), cnt("PENDING_APPROVAL")], ["approved", L("מאושרות", "Approved"), cnt("APPROVED")], ["closed", L("סגורות", "Closed"), cnt("REJECTED", "ALT_PROPOSED", "CANCELLED", "EXPIRED")]] as const).map(([k, label, n]) => (
          <Link key={k} href={`/models?tab=${k}`} className={`rounded-full border px-3.5 py-1.5 text-sm ${tab === k ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`}>{label} · {n}</Link>
        ))}
      </nav>
      {!apps.length ? <EmptyState title={tab === "pending" ? L("אין בקשות שממתינות לאישור", "No pending applications") : L("אין כאן בקשות", "Nothing here")} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {apps.map((a) => {
            const c = customers.find((x) => x.id === a.customerId), w = when(a.startsAt), alt = a.altStartsAt ? when(a.altStartsAt) : null;
            return (
              <Card key={a.id} id={`app-${a.id}`} className={`space-y-3 p-4 ${sp.app === a.id ? "ring-2 ring-gold" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{c ? <Link href={`/crm/${c.id}`} className="hover:text-gold">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</Link> : "—"}</p>
                    <p className="text-sm"><b className="text-gold">{w.date}</b> · <span dir="ltr">{w.time}</span> · {L("שעתיים", "2 hours")}</p>
                    <p className="text-xs text-muted">{L("הוגשה", "Submitted")} {formatDateTime(a.createdAt, locale)}{a.status === "PENDING_APPROVAL" ? ` · ${L("פג תוקף", "expires")} ${formatDateTime(a.expiresAt, locale)}` : ""}</p>
                  </div>
                  <Badge tone={ST[a.status][1]}>{ST[a.status][0]}</Badge>
                </div>
                {c?.phone && <ContactButtons phone={c.phone} he={he} />}
                {canReview && <div className="grid grid-cols-3 gap-2">{photo(a.photoFrontId, L("מקדימה", "Front"))}{photo(a.photoSideId, L("מהצד", "Side"))}{photo(a.photoBackId, L("מאחור", "Back"))}</div>}
                {a.notes && <p className="rounded-lg border border-border bg-surface-2 p-2 text-sm"><b className="text-muted">{L("הערות הלקוח:", "Customer notes:")}</b> {a.notes}</p>}
                {a.rejectReason && <p className="text-sm text-muted">{L("סיבה:", "Reason:")} {a.rejectReason}</p>}
                {alt && <p className="text-sm text-gold">{L("מועד חלופי שהוצע:", "Alternative proposed:")} {alt.date} · <span dir="ltr">{alt.time}</span></p>}
                {a.status === "PENDING_APPROVAL" && canReview && (
                  <div className="space-y-3 border-t border-border pt-3">
                    {isOwner ? (
                      <ActionForm action={approveModelAction}><input type="hidden" name="id" value={a.id} /><SubmitButton className="w-full">{L("אישור בקשה", "Approve application")}</SubmitButton></ActionForm>
                    ) : <p className="text-xs text-muted">{L("רק בעל העסק יכול לאשר.", "Only the owner can approve.")}</p>}
                    <details className="rounded-xl border border-border p-3">
                      <summary className="cursor-pointer text-sm font-medium text-danger">{L("דחיית בקשה", "Reject application")}</summary>
                      <ActionForm action={rejectModelAction} className="mt-3 space-y-2">
                        <input type="hidden" name="id" value={a.id} />
                        <div><Label>{L("סיבה (לא חובה, הלקוח יראה אותה)", "Reason (optional, shown to the customer)")}</Label><Textarea name="reason" rows={2} maxLength={300} /></div>
                        <div><Label>{L("הצעת מועד חלופי (לא חובה)", "Propose another date (optional)")}</Label><Input type="datetime-local" name="alt" step={600} dir="ltr" /></div>
                        <SubmitButton variant="danger" size="sm">{L("דחייה", "Reject")}</SubmitButton>
                      </ActionForm>
                    </details>
                  </div>
                )}
                {settingsEdit && !a.photosDeletedAt && a.status !== "PENDING_APPROVAL" && <InlineAction action={deleteModelPhotosAction} fields={{ id: a.id }} confirm={L("למחוק את התמונות של הבקשה?", "Delete this application's photos?")}>{L("מחיקת התמונות", "Delete photos")}</InlineAction>}
                {a.photosDeletedAt && <p className="text-xs text-muted">{L("התמונות נמחקו", "Photos deleted")} {formatDate(a.photosDeletedAt, locale)}</p>}
              </Card>
            );
          })}
        </div>
      )}
      <Card className="p-5">
        <CardTitle action={<Badge tone={cfg.model.enabled ? "success" : "neutral"}>{cfg.model.enabled ? L("פעיל", "On") : L("כבוי", "Off")}</Badge>}>{L("הגדרות מודליסטים", "Hair-model settings")}</CardTitle>
        <ActionForm action={saveModelSettingsAction} className="grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-2.5 text-sm md:col-span-2"><input type="checkbox" name="enabled" defaultChecked={cfg.model.enabled} disabled={!settingsEdit} className="mt-1 h-4 w-4 accent-[var(--gold)]" /><span>{L("לפתוח בקשות מודליסט באתר", "Open hair-model applications on the website")}<span className="block text-xs text-muted">{L("יופיע ככרטיס \"מודליסט\" בעמוד קביעת התור. ₪0, שעתיים, מקום אחד ביום, באישור שלך בלבד.", "Shown as a \"Hair Model\" card on the booking page. ₪0, 2 hours, one per day, only with your approval.")}</span></span></label>
          <div><Label>{L("כמה שעות בקשה מחכה לאישור לפני שהיא פגה", "Hours a request waits before it expires")}</Label><Input type="number" name="holdHours" min={2} max={240} defaultValue={cfg.model.holdHours} disabled={!settingsEdit} /></div>
          <div><Label>{L("מחיקת תמונות של בקשות סגורות אחרי (ימים)", "Delete photos of closed requests after (days)")}</Label><Input type="number" name="photoRetentionDays" min={1} max={365} defaultValue={cfg.model.photoRetentionDays} disabled={!settingsEdit} /></div>
          <label className="flex items-start gap-2.5 text-sm md:col-span-2"><input type="checkbox" name="releaseOnReject" defaultChecked={cfg.model.releaseOnReject} disabled={!settingsEdit} className="mt-1 h-4 w-4 accent-[var(--gold)]" /><span>{L("אחרי דחייה, היום נפתח שוב לבקשות אחרות", "After a rejection, the day opens again for others")}</span></label>
          <div className="md:col-span-2"><Label>{L("ימים בלי מודליסטים (YYYY-MM-DD, מופרדים בפסיק)", "Days without models (YYYY-MM-DD, comma separated)")}</Label><Input name="disabledDates" defaultValue={cfg.model.disabledDates.join(", ")} dir="ltr" placeholder="2026-12-24, 2026-12-31" disabled={!settingsEdit} /></div>
          {settingsEdit && <div className="md:col-span-2"><SubmitButton>{L("שמירה", "Save")}</SubmitButton></div>}
        </ActionForm>
      </Card>
    </div>
  );
}
