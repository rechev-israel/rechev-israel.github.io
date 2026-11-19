import Link from "next/link";
import { Crown, Gift, Images, Scissors } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { syncCustomerPrograms } from "@/server/services/experience";
import { setRewardStatusAction, setVipAction } from "@/server/actions/experience";
import { InlineAction } from "@/components/forms";
import { Badge, Card, CardTitle } from "@/components/ui";


/** MY CASTEL on the customer page: club progress, rewards, VIP, haircut preferences and the photos they shared. */
export async function ExperienceCard({ businessId, customerId, locale, canEdit, isOwner }: { businessId: string; customerId: string; locale: string; canEdit: boolean; isOwner: boolean }) {
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const { exp, club } = await syncCustomerPrograms(businessId, customerId);
  const [rewards, vip, profile, photos, waits] = await Promise.all([
    db.loyaltyReward.findMany({ where: { customerId }, orderBy: { earnedAt: "desc" }, take: 10 }),
    db.vipMembership.findUnique({ where: { customerId } }),
    canEdit ? db.haircutProfile.findUnique({ where: { customerId } }) : null,
    canEdit ? db.customerPhoto.findMany({ where: { customerId, sharedWithBarber: true }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, note: true } }) : [],
    db.waitlistEntry.findMany({ where: { customerId, status: { in: ["ACTIVE", "NOTIFIED"] } } }),
  ]);
  const vipOn = vip?.status === "ACTIVE";
  const rows: [string, string | null | undefined][] = profile ? [[L("סגנון", "Style"), profile.style], [L("פייד", "Fade"), profile.fade], [L("מספרים", "Guards"), profile.guards], [L("אורך למעלה", "Top"), profile.topLength], [L("זקן", "Beard"), profile.beard], [L("עיצוב", "Styling"), profile.styling]] : [];
  const refPhoto = profile?.photoId && !photos.some((p) => p.id === profile.photoId) ? profile.photoId : null;
  return (
    <Card className="mb-4 p-4">
      <CardTitle action={<Link href="/experience" className="text-xs text-gold">MY CASTEL</Link>}>{L("חוויית לקוח", "Customer experience")}</CardTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Gift size={14} className="text-gold" />CASTEL CLUB {!exp.club.enabled && <Badge>{L("כבוי", "Off")}</Badge>}</p>
          <div className="flex items-center gap-1" aria-label={`${club.inCard}/${club.required}`}>{Array.from({ length: club.required }, (_, i) => <span key={i} className={`h-2.5 flex-1 rounded-full ${i < club.inCard ? "bg-gold" : "bg-surface-2"}`} />)}</div>
          <p className="mt-1 text-xs text-muted">{L(`${club.visits} ביקורים שנספרים · עוד ${club.remaining} להטבה`, `${club.visits} qualifying visits · ${club.remaining} to go`)}</p>
          {rewards.length > 0 && <ul className="mt-2 space-y-1.5">{rewards.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{r.label} <span className="text-xs text-muted">· {formatDate(r.earnedAt, locale)}</span></span>
              <span className="flex items-center gap-2"><Badge tone={r.status === "AVAILABLE" ? "gold" : r.status === "REDEEMED" ? "success" : "neutral"}>{({ AVAILABLE: L("זמינה", "Available"), REDEEMED: L("מומשה", "Redeemed"), EXPIRED: L("פגה", "Expired"), VOID: L("בוטלה", "Void") } as Record<string, string>)[r.status]}</Badge>
                {canEdit && r.status === "AVAILABLE" && <InlineAction action={setRewardStatusAction} fields={{ id: r.id, status: "REDEEMED" }} variant="primary">{L("מימוש", "Redeem")}</InlineAction>}</span></li>))}</ul>}
        </section>
        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Crown size={14} className="text-gold" />CASTEL VIP {!exp.vip.enabled && <Badge>{L("כבוי", "Off")}</Badge>}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={vipOn ? "gold" : "neutral"}>{vipOn ? `VIP · ${L("מאז", "since")} ${formatDate(vip!.since, locale)}` : L("לא חבר VIP", "Not VIP")}</Badge>
            {isOwner && <InlineAction action={setVipAction} fields={{ customerId, on: vipOn ? "0" : "1" }} variant={vipOn ? "ghost" : "secondary"} confirm={vipOn ? L("להסיר מ־VIP?", "Remove VIP?") : undefined}>{vipOn ? L("הסרה מ־VIP", "Remove VIP") : L("צירוף ל־VIP", "Make VIP")}</InlineAction>}
          </div>
          {waits.length > 0 && <p className="mt-3 text-xs text-gold">⏳ {L(`ברשימת המתנה (${waits.length})`, `On the waitlist (${waits.length})`)} · <Link href="/experience?tab=waitlist" className="underline">{L("פרטים", "Details")}</Link></p>}
        </section>
        {canEdit && (
          <section className="md:col-span-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Scissors size={14} className="text-gold" />{L("התספורת שלו (MY HAIRCUT)", "Haircut preferences (MY HAIRCUT)")}</p>
            {!profile ? <p className="text-xs text-muted">{L("הלקוח עוד לא מילא פרופיל תספורת ב־MY CASTEL.", "No haircut profile yet.")}</p> : (
              <div className="flex flex-wrap gap-4">
                {refPhoto && <img src={`/api/admin/photos/${refPhoto}`} alt={L("תמונת רפרנס", "Reference photo")} className="h-28 w-24 rounded-xl border border-border object-cover" />}
                <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                  {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>)}
                  {profile.notes && <div className="col-span-full"><dt className="text-xs text-muted">{L("הערות", "Notes")}</dt><dd className="whitespace-pre-line">{profile.notes}</dd></div>}
                  <div className="col-span-full text-xs text-muted">{L("עודכן", "Updated")} {formatDate(profile.updatedAt, locale)}</div>
                </dl>
              </div>
            )}
            {photos.length > 0 && (<>
              <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-sm font-medium"><Images size={14} className="text-gold" />{L("תמונות שהלקוח שיתף איתך", "Photos shared with you")}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">{photos.map((p) => <figure key={p.id} className="w-24 shrink-0"><img src={`/api/admin/photos/${p.id}`} alt={p.note ?? ""} loading="lazy" className="h-28 w-24 rounded-xl border border-border object-cover" />{p.note && <figcaption className="mt-1 truncate text-[11px] text-muted">{p.note}</figcaption>}</figure>)}</div>
            </>)}
          </section>
        )}
      </div>
    </Card>
  );
}
