import Link from "next/link";
import { BellRing, Crown, Gift, Hourglass, MessageSquareQuote, Sparkles, Ticket, Users } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getExperience } from "@/server/services/experience";
import { providerFor } from "@/server/comms/providers";
import { closeWaitlistAction, rejectReferralAction, saveExperienceAction, setRewardStatusAction } from "@/server/actions/experience";
import { cancelGiftAction, markGiftPaidAction, redeemGiftAction } from "@/server/actions/client-features";
import { ActionForm, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "חוויית לקוח" };
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Customer Experience — MY CASTEL programs. Everything here is off until the owner turns it on. */
export default async function ExperiencePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, t, locale, allowed } = await pageGuard("crm.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const he = locale === "he";
  const L = (h: string, e: string) => (he ? h : e);
  const owner = can(user.role, "services.edit");
  const staff = can(user.role, "crm.edit");
  const biz = user.businessId;
  const sp = await searchParams;
  const tab = (["club", "vip", "friends", "surprise", "gifts", "waitlist", "reminders", "feedback"] as const).find((x) => x === sp.tab) ?? "club";
  const exp = await getExperience(biz);
  const [rewardsAvail, vipCount, waitActive, refPending, fb] = await Promise.all([
    db.loyaltyReward.count({ where: { businessId: biz, status: "AVAILABLE" } }),
    db.vipMembership.count({ where: { businessId: biz, status: "ACTIVE" } }),
    db.waitlistEntry.count({ where: { businessId: biz, status: { in: ["ACTIVE", "NOTIFIED"] } } }),
    db.referral.count({ where: { businessId: biz, status: "PENDING" } }),
    db.review.aggregate({ where: { businessId: biz }, _avg: { rating: true, serviceRating: true }, _count: true }),
  ]);
  const TABS = [
    ["club", "CASTEL CLUB", Gift], ["vip", "CASTEL VIP", Crown], ["friends", L("חבר מביא חבר", "Refer a friend"), Users], ["surprise", L("הפתעות", "Surprises"), Sparkles], ["gifts", L("כרטיסי מתנה", "Gift cards"), Ticket],
    ["waitlist", L("רשימת המתנה", "Waitlist"), Hourglass], ["reminders", L("תזכורות", "Reminders"), BellRing], ["feedback", L("משוב", "Feedback"), MessageSquareQuote],
  ] as const;
  const onOff = (v: boolean) => <Badge tone={v ? "success" : "neutral"}>{v ? L("פעיל", "On") : L("כבוי", "Off")}</Badge>;
  const check = (name: string, label: string, checked: boolean, hint?: string) => (
    <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" name={name} defaultChecked={checked} disabled={!owner} className="mt-1 h-4 w-4 accent-[var(--gold)]" /><span>{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span></label>
  );
  const save = owner ? <SubmitButton>{L("שמירה", "Save")}</SubmitButton> : <p className="text-xs text-muted">{L("רק בעל העסק יכול לשנות הגדרות.", "Only the owner can change settings.")}</p>;

  return (
    <div className="space-y-5">
      <PageHeader title={L("חוויית לקוח", "Customer Experience")} subtitle={L("MY CASTEL: מועדון, VIP, חבר מביא חבר, רשימת המתנה, תזכורות ומשוב. כל תוכנית כבויה עד שתפעיל אותה, והלקוחות רואים רק מה שהפעלת.", "MY CASTEL programs. Each one is off until you turn it on; customers only see what you enable.")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={L("הטבות שממתינות למימוש", "Rewards to redeem")} value={rewardsAvail} />
        <Stat label={L("חברי VIP", "VIP members")} value={vipCount} />
        <Stat label={L("ברשימת המתנה", "On waitlist")} value={waitActive} />
        <Stat label={L("הפניות בהמתנה", "Pending referrals")} value={refPending} />
        <Stat label={L("ממוצע ביקורות", "Avg rating")} value={fb._avg.rating ? fb._avg.rating.toFixed(1) : "—"} hint={`${fb._count} ${L("ביקורות", "reviews")}`} />
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={L("תוכניות", "Programs")}>
        {TABS.map(([k, label, Icon]) => (
          <Link key={k} href={`/experience?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${tab === k ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`}><Icon size={14} />{label}</Link>
        ))}
      </nav>

      {tab === "club" && (await (async () => {
        const c = exp.club;
        const rewards = await db.loyaltyReward.findMany({ where: { businessId: biz }, orderBy: { earnedAt: "desc" }, take: 60, include: { customer: { select: { id: true, firstName: true, lastName: true } } } });
        return (<>
          <Card className="p-5">
            <CardTitle action={onOff(c.enabled)}>CASTEL CLUB · {L("כרטיס מועדון דיגיטלי", "Digital loyalty card")}</CardTitle>
            <p className="mb-4 text-sm text-muted">{L("נספרים רק תורים שהושלמו (לא בוטלו ולא \"לא הגיע\"), עד ביקור אחד ביום. כל הטבה נוצרת פעם אחת ונשמרת עד שתסמן שמימשת אותה.", "Only completed visits count (never cancelled / no-show), at most one per day. Each reward is issued once.")}</p>
            <ActionForm action={saveExperienceAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="section" value="club" />
              <div className="md:col-span-2">{check("enabled", L("להפעיל את המועדון ולהציג ללקוחות ב־MY CASTEL", "Enable the club and show it in MY CASTEL"), c.enabled)}</div>
              <div><Label>{L("ביקורים להטבה", "Visits per reward")}</Label><Input type="number" name="visitsRequired" min={2} max={100} defaultValue={c.visitsRequired} disabled={!owner} /></div>
              <div><Label>{L("סוג ההטבה", "Reward type")}</Label><Select name="rewardType" defaultValue={c.rewardType} disabled={!owner}><option value="free_service">{L("תספורת חינם", "Free haircut")}</option><option value="discount_percent">{L("הנחה באחוזים", "% discount")}</option><option value="discount_amount">{L("הנחה בשקלים", "₪ discount")}</option><option value="gift">{L("מתנה", "Gift")}</option></Select></div>
              <div><Label>{L("ערך (אחוז / ₪)", "Value (% / ₪)")}</Label><Input type="number" name="rewardValue" min={0} max={10000} defaultValue={c.rewardValue} disabled={!owner} /></div>
              <div><Label>{L("ניסוח ההטבה ללקוח (לא חובה)", "Reward wording (optional)")}</Label><Input name="rewardLabel" maxLength={80} defaultValue={c.rewardLabel} placeholder={L("למשל: תספורת עשירית עלינו", "e.g. Your 10th cut is on us")} disabled={!owner} /></div>
              <div><Label>{L("תוקף ההטבה בימים (0 = ללא)", "Expires after days (0 = never)")}</Label><Input type="number" name="expiryDays" min={0} max={3650} defaultValue={c.expiryDays} disabled={!owner} /></div>
              <div className="self-end">{check("premiumQualifies", L("תורי פרימיום נספרים", "Premium appointments count"), c.premiumQualifies)}</div>
              <div className="md:col-span-2"><Label>{L("תנאים (מוצג ללקוח)", "Conditions (shown to customers)")}</Label><Textarea name="conditions" rows={2} maxLength={300} defaultValue={c.conditions} disabled={!owner} /></div>
              <div className="md:col-span-2">{save}</div>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <CardTitle>{L("הטבות שהלקוחות צברו", "Rewards earned")}</CardTitle>
            {!rewards.length ? <EmptyState title={L("עדיין אין הטבות", "No rewards yet")} /> : (
              <ul className="divide-y divide-border">
                {rewards.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span><Link href={`/crm/${r.customer.id}`} className="font-medium hover:text-gold">{[r.customer.firstName, r.customer.lastName].filter(Boolean).join(" ")}</Link> · {r.label} <span className="text-xs text-muted">({r.kind === "referral" ? L("חבר מביא חבר", "referral") : "CLUB"} · {formatDate(r.earnedAt, locale)}{r.expiresAt ? ` · ${L("בתוקף עד", "until")} ${formatDate(r.expiresAt, locale)}` : ""})</span></span>
                    <span className="flex items-center gap-2">
                      <Badge tone={r.status === "AVAILABLE" ? "gold" : r.status === "REDEEMED" ? "success" : "neutral"}>{({ AVAILABLE: L("זמינה", "Available"), REDEEMED: L("מומשה", "Redeemed"), EXPIRED: L("פגה", "Expired"), VOID: L("בוטלה", "Void") } as Record<string, string>)[r.status]}</Badge>
                      {staff && r.status === "AVAILABLE" && <InlineAction action={setRewardStatusAction} fields={{ id: r.id, status: "REDEEMED" }} variant="primary">{L("מימוש", "Redeem")}</InlineAction>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>);
      })())}

      {tab === "vip" && (await (async () => {
        const v = exp.vip;
        const members = await db.vipMembership.findMany({ where: { businessId: biz }, orderBy: { since: "desc" }, include: { customer: { select: { id: true, firstName: true, lastName: true, visitCount: true } } } });
        return (<>
          <Card className="p-5">
            <CardTitle action={onOff(v.enabled)}>CASTEL VIP</CardTitle>
            <p className="mb-4 text-sm text-muted">{L("חברות VIP נפרדת לגמרי מתור הפרימיום. אין כאן מחירים או הנחות אוטומטיות, רק הטבות שאתה כותב. מצרפים לקוח ידנית מהדף שלו, או אוטומטית אחרי מספר ביקורים.", "VIP is separate from the Premium appointment. No automatic prices or discounts — only benefits you write.")}</p>
            <ActionForm action={saveExperienceAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="section" value="vip" />
              <div className="md:col-span-2">{check("enabled", L("להפעיל את CASTEL VIP", "Enable CASTEL VIP"), v.enabled)}</div>
              <div>{check("autoEnabled", L("צירוף אוטומטי אחרי מספר ביקורים", "Join automatically after visits"), v.autoEnabled, L("לקוח שהסרת לא יצורף שוב אוטומטית.", "Someone you removed is never re-added automatically."))}</div>
              <div><Label>{L("ביקורים שהושלמו לצירוף", "Completed visits to join")}</Label><Input type="number" name="autoMinVisits" min={1} max={500} defaultValue={v.autoMinVisits} disabled={!owner} /></div>
              <div className="md:col-span-2"><Label>{L("הטבות VIP (שורה לכל הטבה, עד 8)", "VIP benefits (one per line, up to 8)")}</Label><Textarea name="benefits" rows={4} defaultValue={v.benefits.join("\n")} placeholder={L("עדיפות ברשימת ההמתנה\nשתייה על חשבון הבית", "Waitlist priority\nComplimentary drink")} disabled={!owner} /></div>
              <div className="md:col-span-2"><Label>{L("הודעה לחברי VIP (מוצגת ב־MY CASTEL)", "VIP announcement (shown in MY CASTEL)")}</Label><Textarea name="announcement" rows={2} maxLength={400} defaultValue={v.announcement} disabled={!owner} /></div>
              <div className="md:col-span-2">{check("waitlistPriority", L("עדיפות ברשימת ההמתנה: חברי VIP מקבלים הודעה ראשונים", "Waitlist priority: VIP members are told first"), v.waitlistPriority)}</div>
              <div className="md:col-span-2">{save}</div>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <CardTitle>{L("חברים", "Members")}</CardTitle>
            {!members.length ? <EmptyState title={L("עדיין אין חברי VIP", "No VIP members yet")}>{L("מצרפים לקוח מהדף שלו בלקוחות.", "Add someone from their customer page.")}</EmptyState> : (
              <ul className="divide-y divide-border">{members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/crm/${m.customer.id}`} className="font-medium hover:text-gold">{[m.customer.firstName, m.customer.lastName].filter(Boolean).join(" ")}</Link>
                  <span className="flex items-center gap-2 text-xs text-muted">{m.source === "AUTO" ? L("אוטומטי", "Auto") : L("ידני", "Manual")} · {formatDate(m.since, locale)} <Badge tone={m.status === "ACTIVE" ? "gold" : "neutral"}>{m.status === "ACTIVE" ? "VIP" : L("הוסר", "Removed")}</Badge></span>
                </li>))}</ul>
            )}
          </Card>
        </>);
      })())}

      {tab === "friends" && (await (async () => {
        const r = exp.referral;
        const refs = await db.referral.findMany({ where: { businessId: biz }, orderBy: { createdAt: "desc" }, take: 80 });
        const people = await db.customer.findMany({ where: { id: { in: refs.flatMap((x) => [x.referrerId, x.referredId]) } }, select: { id: true, firstName: true, lastName: true } });
        const nm = (id: string) => { const p = people.find((x) => x.id === id); return p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "—"; };
        return (<>
          <Card className="p-5">
            <CardTitle action={onOff(r.enabled)}>CASTEL FRIENDS · {L("חבר מביא חבר", "Refer a friend")}</CardTitle>
            <p className="mb-4 text-sm text-muted">{L("כל לקוח מקבל קוד אישי. נספר רק לקוח חדש לגמרי (בלי תורים קודמים), לא הלקוח עצמו, ופעם אחת בלבד. ההטבה נוצרת רק אחרי שהחבר השלים ביקור.", "Each customer gets a personal code. Only brand-new customers count, never themselves, once. The reward is created after the friend's completed visit.")}</p>
            <ActionForm action={saveExperienceAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="section" value="referral" />
              <div className="md:col-span-2">{check("enabled", L("להפעיל חבר מביא חבר", "Enable referrals"), r.enabled)}</div>
              <div><Label>{L("הטבה למביא", "Reward for the referrer")}</Label><Input name="referrerRewardLabel" maxLength={80} defaultValue={r.referrerRewardLabel} placeholder={L("למשל: 50% על התספורת הבאה", "e.g. 50% off next cut")} disabled={!owner} /></div>
              <div><Label>{L("הטבה לחבר החדש", "Reward for the friend")}</Label><Input name="friendRewardLabel" maxLength={80} defaultValue={r.friendRewardLabel} disabled={!owner} /></div>
              <div className="md:col-span-2">{check("bothBenefit", L("גם החבר החדש מקבל הטבה", "The new friend gets a reward too"), r.bothBenefit)}</div>
              <div><Label>{L("ביקורים שהחבר צריך להשלים", "Friend's completed visits needed")}</Label><Input type="number" name="minCompleted" min={1} max={10} defaultValue={r.minCompleted} disabled={!owner} /></div>
              <div><Label>{L("מקסימום הפניות ללקוח", "Max referrals per customer")}</Label><Input type="number" name="maxPerCustomer" min={1} max={100} defaultValue={r.maxPerCustomer} disabled={!owner} /></div>
              <div><Label>{L("תוקף ההטבה בימים (0 = ללא)", "Expires after days (0 = never)")}</Label><Input type="number" name="expiryDays" min={0} max={3650} defaultValue={r.expiryDays} disabled={!owner} /></div>
              <div className="md:col-span-2"><Label>{L("תנאים (מוצג ללקוח)", "Conditions (shown to customers)")}</Label><Textarea name="conditions" rows={2} maxLength={300} defaultValue={r.conditions} disabled={!owner} /></div>
              <div className="md:col-span-2">{save}</div>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <CardTitle>{L("הפניות", "Referrals")}</CardTitle>
            {!refs.length ? <EmptyState title={L("עדיין אין הפניות", "No referrals yet")} /> : (
              <ul className="divide-y divide-border">{refs.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span><Link href={`/crm/${x.referrerId}`} className="font-medium hover:text-gold">{nm(x.referrerId)}</Link> → <Link href={`/crm/${x.referredId}`} className="hover:text-gold">{nm(x.referredId)}</Link> <span className="text-xs text-muted">· {formatDate(x.createdAt, locale)}</span></span>
                  <span className="flex items-center gap-2"><Badge tone={x.status === "QUALIFIED" ? "success" : x.status === "PENDING" ? "warning" : "neutral"}>{({ PENDING: L("ממתין לביקור", "Waiting for visit"), QUALIFIED: L("עמד בתנאים", "Qualified"), REJECTED: L("נדחה", "Rejected") } as Record<string, string>)[x.status]}</Badge>
                    {owner && x.status === "PENDING" && <InlineAction action={rejectReferralAction} fields={{ id: x.id }} confirm={L("לדחות את ההפניה?", "Reject this referral?")}>{L("דחייה", "Reject")}</InlineAction>}</span>
                </li>))}</ul>
            )}
          </Card>
        </>);
      })())}

      {tab === "surprise" && (await (async () => {
        const c = exp.surprise;
        const recent = await db.loyaltyReward.findMany({ where: { businessId: biz, kind: "surprise" }, orderBy: { earnedAt: "desc" }, take: 40, include: { customer: { select: { id: true, firstName: true, lastName: true } } } });
        return (<>
          <Card className="p-5">
            <CardTitle action={onOff(c.enabled)}>{L("ההפתעה שלך מ־CASTEL", "Your CASTEL surprise")}</CardTitle>
            <p className="mb-4 text-sm text-muted">{L("אחרי תור שהושלם, הלקוח מקבל ב־MY CASTEL כרטיס גירוד. ההטבה נבחרת מראש בשרת מתוך הרשימה שלך, והגירוד רק חושף אותה. פעם אחת לכל תור, בחינם, בלי הימורים ובלי פרסים כספיים.", "After a completed visit the customer gets a scratch card in MY CASTEL. The benefit is assigned on the server from your list; scratching only reveals it. Once per visit, free.")}</p>
            <ActionForm action={saveExperienceAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="section" value="surprise" />
              <div className="md:col-span-2">{check("enabled", L("להפעיל הפתעות אחרי תור", "Enable post-visit surprises"), c.enabled)}</div>
              <div className="md:col-span-2"><Label>{L("ההטבות (שורה לכל הטבה; אפשר להוסיף | ומשקל, למשל: 10% הנחה | 3)", "Benefits (one per line; optional | weight, e.g. 10% off | 3)")}</Label><Textarea name="rewards" rows={5} defaultValue={c.rewards.map((r) => (r.weight > 1 ? `${r.label} | ${r.weight}` : r.label)).join("\n")} placeholder={L("10% הנחה על התספורת הבאה | 3\nשדרוג עיצוב זקן חינם | 1", "10% off next cut | 3\nFree beard upgrade | 1")} disabled={!owner} /></div>
              <div><Label>{L("זכאות: תור שהושלם ב־X הימים האחרונים", "Eligible: visit completed in the last X days")}</Label><Input type="number" name="windowDays" min={1} max={60} defaultValue={c.windowDays} disabled={!owner} /></div>
              <div><Label>{L("תוקף ההטבה בימים (0 = ללא)", "Expires after days (0 = never)")}</Label><Input type="number" name="expiryDays" min={0} max={3650} defaultValue={c.expiryDays} disabled={!owner} /></div>
              <div className="md:col-span-2"><Label>{L("תנאים (מוצג ללקוח)", "Terms (shown to customers)")}</Label><Textarea name="terms" rows={2} maxLength={300} defaultValue={c.terms} disabled={!owner} /></div>
              <div className="md:col-span-2">{save}</div>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <CardTitle>{L("הפתעות שחולקו", "Surprises given")}</CardTitle>
            {!recent.length ? <EmptyState title={L("עדיין לא חולקו הפתעות", "None yet")} /> : <ul className="divide-y divide-border">{recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><Link href={`/crm/${r.customer.id}`} className="font-medium hover:text-gold">{[r.customer.firstName, r.customer.lastName].filter(Boolean).join(" ")}</Link> · {r.label} <span className="text-xs text-muted">· {r.revealedAt ? L("נחשפה", "Revealed") : L("טרם נחשפה", "Not revealed")} · {formatDate(r.earnedAt, locale)}</span></span>
                <span className="flex items-center gap-2"><Badge tone={r.status === "AVAILABLE" ? "gold" : r.status === "REDEEMED" ? "success" : "neutral"}>{({ AVAILABLE: L("זמינה", "Available"), REDEEMED: L("מומשה", "Redeemed"), EXPIRED: L("פגה", "Expired"), VOID: L("בוטלה", "Void") } as Record<string, string>)[r.status]}</Badge>
                  {staff && r.status === "AVAILABLE" && <InlineAction action={setRewardStatusAction} fields={{ id: r.id, status: "REDEEMED" }} variant="primary">{L("מימוש", "Redeem")}</InlineAction>}</span>
              </li>))}</ul>}
          </Card>
        </>);
      })())}

      {tab === "gifts" && (await (async () => {
        const c = exp.gifts;
        const cards = await db.giftCard.findMany({ where: { businessId: biz }, orderBy: { createdAt: "desc" }, take: 80 });
        const ST: Record<string, [string, "warning" | "gold" | "success" | "neutral"]> = { REQUESTED: [L("ממתין לתשלום", "Awaiting payment"), "warning"], ACTIVE: [L("פעיל", "Active"), "gold"], REDEEMED: [L("מומש", "Redeemed"), "success"], CANCELLED: [L("בוטל", "Cancelled"), "neutral"], EXPIRED: [L("פג תוקף", "Expired"), "neutral"] };
        return (<>
          <Card className="p-5">
            <CardTitle>{L("מימוש כרטיס מתנה", "Redeem a gift card")}</CardTitle>
            <ActionForm action={redeemGiftAction} className="flex flex-wrap items-end gap-2" resetOnSuccess>
              <div className="min-w-[220px] flex-1"><Label>{L("קוד הכרטיס", "Card code")}</Label><Input name="code" placeholder="GIFT-XXXX-XXXX" dir="ltr" required /></div>
              <SubmitButton>{L("מימוש", "Redeem")}</SubmitButton>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <CardTitle action={onOff(c.enabled)}>{L("מתנה בסטייל · כרטיסי מתנה", "Gift cards")}</CardTitle>
            <p className="mb-4 text-sm text-muted">{L("אין תשלום באתר. לקוח שולח בקשה, אתה מקבל התראה, גובה בדרך שלך (מזומן, ביט וכו׳) ולוחץ \"שולם\". רק אז נוצר קוד ייחודי, והקונה מקבל את הכרטיס בקישור הפרטי שלו. כל כרטיס ממומש פעם אחת.", "No online payment. You get the request, take payment your usual way and press Paid; only then a unique code is issued. Each card redeems once.")}</p>
            <ActionForm action={saveExperienceAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="section" value="gifts" />
              <div className="md:col-span-2">{check("enabled", L("להפעיל כרטיסי מתנה באתר", "Enable gift cards on the website"), c.enabled)}</div>
              <div><Label>{L("סכומים לבחירה (₪, מופרדים בפסיק)", "Amounts (₪, comma separated)")}</Label><Input name="amounts" defaultValue={c.amounts.join(", ")} dir="ltr" disabled={!owner} /></div>
              <div className="self-end">{check("allowServices", L("אפשר גם מתנה של שירות מסוים", "Allow gifting a specific service"), c.allowServices)}</div>
              <div><Label>{L("תוקף בחודשים (0 = ללא)", "Valid for months (0 = no expiry)")}</Label><Input type="number" name="expiryMonths" min={0} max={60} defaultValue={c.expiryMonths} disabled={!owner} /></div>
              <div className="md:col-span-2"><Label>{L("איך משלמים (מוצג לקונה)", "How to pay (shown to the buyer)")}</Label><Textarea name="payNote" rows={2} maxLength={300} defaultValue={c.payNote} placeholder={L("נחזור אליך בוואטסאפ לתשלום בביט או במזומן במספרה.", "We'll contact you to pay by Bit or cash at the shop.")} disabled={!owner} /></div>
              <div className="md:col-span-2"><Label>{L("תנאי מימוש (מוצג על הכרטיס)", "Redemption terms (on the card)")}</Label><Textarea name="terms" rows={2} maxLength={400} defaultValue={c.terms} disabled={!owner} /></div>
              <div className="md:col-span-2">{save}</div>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <CardTitle>{L("בקשות וכרטיסים", "Requests & cards")}</CardTitle>
            {!cards.length ? <EmptyState title={L("עדיין אין כרטיסי מתנה", "No gift cards yet")} /> : <ul className="divide-y divide-border">{cards.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0">
                  <b className="font-medium">{g.serviceName ?? `₪${g.amount}`}</b> · {L("עבור", "for")} {g.recipientName}
                  <span className="block text-xs text-muted">{L("קונה:", "Buyer:")} {g.buyerName} · <a href={`tel:${g.buyerPhone}`} dir="ltr" className="text-gold">{g.buyerPhone}</a> · {formatDate(g.createdAt, locale)}{g.code ? ` · ` : ""}{g.code && <span dir="ltr" className="font-mono">{g.code}</span>}{g.expiresAt ? ` · ${L("עד", "until")} ${formatDate(g.expiresAt, locale)}` : ""}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2"><Badge tone={ST[g.status][1]}>{ST[g.status][0]}</Badge>
                  {owner && g.status === "REQUESTED" && <InlineAction action={markGiftPaidAction} fields={{ id: g.id }} variant="primary" confirm={L("לאשר שהתשלום התקבל? ייווצר קוד מימוש.", "Confirm payment received? A code will be issued.")}>{L("שולם", "Paid")}</InlineAction>}
                  {owner && (g.status === "REQUESTED" || g.status === "ACTIVE") && <InlineAction action={cancelGiftAction} fields={{ id: g.id }} confirm={L("לבטל את הכרטיס?", "Cancel this card?")}>{L("ביטול", "Cancel")}</InlineAction>}
                </span>
              </li>))}</ul>}
          </Card>
        </>);
      })())}

      {tab === "waitlist" && (await (async () => {
        const list = await db.waitlistEntry.findMany({ where: { businessId: biz }, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 100, include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } } });
        const svcs = await db.service.findMany({ where: { id: { in: list.map((x) => x.serviceId) } }, select: { id: true, nameHe: true } });
        const live = list.filter((x) => x.status === "ACTIVE" || x.status === "NOTIFIED");
        return (
          <Card className="p-5">
            <CardTitle>{L("רשימת המתנה", "Waitlist")}</CardTitle>
            <p className="mb-4 text-sm text-muted">{L("לקוחות נרשמים מ־MY CASTEL. כשמתפנה שעה מתאימה, המערכת מודיעה ללקוח ב־MY CASTEL ומודיעה לך בפעמון. התור לא נשמר אוטומטית: הלקוח קובע בעצמו, ומי שקובע ראשון מקבל את השעה. הודעת וואטסאפ נשלחת רק אם הלקוח ביקש וחיברת וואטסאפ.", "Customers join from MY CASTEL. When a matching time opens, they're told in MY CASTEL and you get a notification. Nothing is reserved automatically.")}</p>
            {!live.length ? <EmptyState title={L("אין כרגע ממתינים", "Nobody is waiting")} /> : (
              <ul className="divide-y divide-border">{live.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/crm/${w.customer.id}`} className="font-medium hover:text-gold">{[w.customer.firstName, w.customer.lastName].filter(Boolean).join(" ")}</Link>
                    <span className="block text-xs text-muted">{svcs.find((s) => s.id === w.serviceId)?.nameHe ?? ""} · {w.dates.map((d) => d.slice(8, 10) + "." + d.slice(5, 7)).join(", ")} · <span dir="ltr">{hm(w.fromMin)}–{hm(w.toMin)}</span> · {w.notify === "whatsapp" ? "WhatsApp" : "MY CASTEL"}</span>
                    {w.status === "NOTIFIED" && w.matchDate && <span className="block text-xs text-gold">{L("התפנה:", "Opened:")} {w.matchDate.slice(8, 10)}.{w.matchDate.slice(5, 7)} <span dir="ltr">{hm(w.matchStart ?? 0)}</span></span>}
                  </span>
                  {staff && <span className="flex gap-2"><InlineAction action={closeWaitlistAction} fields={{ id: w.id, status: "BOOKED" }} variant="secondary">{L("סודר", "Arranged")}</InlineAction><InlineAction action={closeWaitlistAction} fields={{ id: w.id, status: "LEFT" }} confirm={L("להסיר מרשימת ההמתנה?", "Remove from waitlist?")}>{L("הסרה", "Remove")}</InlineAction></span>}
                </li>))}</ul>
            )}
          </Card>
        );
      })())}

      {tab === "reminders" && (await (async () => {
        const r = exp.reminders;
        const connected = Boolean(providerFor("WHATSAPP")?.configured());
        const recent = await db.appointmentReminder.groupBy({ by: ["outcome"], where: { businessId: biz, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true });
        const OUT: Record<string, string> = { sent: L("נשלחו", "Sent"), queued: L("בתור לשליחה", "Queued"), pending_approval: L("ממתינות לאישורך", "Awaiting your approval"), skipped_not_connected: L("לא נשלחו (וואטסאפ לא מחובר)", "Not sent (WhatsApp not connected)"), blocked_no_consent: L("נחסמו (אין הסכמה/טלפון)", "Blocked (no consent/phone)"), failed: L("נכשלו", "Failed") };
        return (
          <Card className="p-5">
            <CardTitle action={onOff(r.enabled)}>{L("תזכורות חכמות", "Smart reminders")}</CardTitle>
            {!connected && <Notice tone="warning" className="mb-4">{L("וואטסאפ עדיין לא מחובר, לכן תזכורות לא יכולות להישלח בפועל. כל תזכורת תירשם כ״לא נשלחה״ ולא תישלח באיחור. אחרי חיבור וואטסאפ (חיבורים → WhatsApp) הן ייצאו אוטומטית. בינתיים הלקוחות רואים את התזכורות בתוך MY CASTEL ויכולים להוסיף את התור ליומן בטלפון.", "WhatsApp isn't connected yet, so reminders can't actually be sent; each one is recorded as not sent. Customers still see reminders inside MY CASTEL and can add the appointment to their phone calendar.")}</Notice>}
            <ActionForm action={saveExperienceAction} className="space-y-3">
              <input type="hidden" name="section" value="reminders" />
              {check("enabled", L("להפעיל תזכורות אוטומטיות ללקוחות", "Enable automatic customer reminders"), r.enabled, L("נשלחות בוואטסאפ דרך מערכת ההודעות הקיימת, עם בדיקות ההסכמה הקיימות. תזכורת אחת לכל תור, תור שבוטל לא מקבל תזכורת, ותור שהוזז מקבל תזכורת חדשה.", "Sent by WhatsApp through the existing messaging with its consent checks. One per appointment; cancelled ones get none; moved ones get a new one."))}
              {check("h24", L("24 שעות לפני התור", "24 hours before"), r.h24)}
              {check("h2", L("שעתיים לפני התור", "2 hours before"), r.h2)}
              <p className="text-xs text-muted">{L("שים לב: באוטומציות קיימת גם תזכורת יומית ״תורים של מחר״. אם תפעיל כאן 24 שעות, כדאי לכבות אותה כדי שלקוח לא יקבל שתיים.", "Note: Automations also has a daily \"tomorrow's appointments\" reminder — turn it off if you enable 24h here.")}</p>
              {save}
            </ActionForm>
            <div className="mt-5 border-t border-border pt-4 text-sm">
              <p className="mb-2 font-medium">{L("30 הימים האחרונים", "Last 30 days")}</p>
              {!recent.length ? <p className="text-muted">{L("עדיין לא נוצרו תזכורות.", "No reminders yet.")}</p> : <ul className="space-y-1">{recent.map((x) => <li key={x.outcome} className="flex justify-between"><span>{OUT[x.outcome] ?? x.outcome}</span><b>{x._count}</b></li>)}</ul>}
            </div>
          </Card>
        );
      })())}

      {tab === "feedback" && (await (async () => {
        const [byStars, verified, privateOnes, notes] = await Promise.all([
          db.review.groupBy({ by: ["rating"], where: { businessId: biz }, _count: true }),
          db.review.count({ where: { businessId: biz, verified: true } }),
          db.review.count({ where: { businessId: biz, publicConsent: false } }),
          db.review.findMany({ where: { businessId: biz, suggestion: { not: null } }, orderBy: { createdAt: "desc" }, take: 40, select: { id: true, name: true, rating: true, serviceRating: true, suggestion: true, createdAt: true, customerId: true } }),
        ]);
        const total = byStars.reduce((s, x) => s + x._count, 0) || 1;
        return (<>
          <Card className="p-5">
            <CardTitle action={<Link href="/reviews" className="text-sm text-gold">{L("לכל הביקורות", "All reviews")}</Link>}>{L("משוב לקוחות", "Customer feedback")}</CardTitle>
            <div className="grid gap-5 md:grid-cols-2">
              <ul className="space-y-1.5">{[5, 4, 3, 2, 1].map((n) => { const c = byStars.find((x) => x.rating === n)?._count ?? 0; return (
                <li key={n} className="flex items-center gap-2 text-sm"><span className="w-8 text-gold">{n}★</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full bg-gold" style={{ width: `${(c / total) * 100}%` }} /></span><span className="w-8 text-end tabular-nums text-muted">{c}</span></li>); })}</ul>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">{L("ממוצע כללי", "Overall")}</dt><dd className="font-display text-2xl text-gold">{fb._avg.rating?.toFixed(1) ?? "—"}</dd></div>
                <div><dt className="text-muted">{L("ממוצע שירות", "Service")}</dt><dd className="font-display text-2xl text-gold">{fb._avg.serviceRating?.toFixed(1) ?? "—"}</dd></div>
                <div><dt className="text-muted">{L("אחרי ביקור שהושלם", "After a completed visit")}</dt><dd className="text-lg">{verified}</dd></div>
                <div><dt className="text-muted">{L("פרטיות (לא באתר)", "Private (not on site)")}</dt><dd className="text-lg">{privateOnes}</dd></div>
              </dl>
            </div>
          </Card>
          <Card className="p-5">
            <CardTitle>{L("הצעות לשיפור (פרטי, רק אצלך)", "Improvement ideas (private)")}</CardTitle>
            {!notes.length ? <EmptyState title={L("עדיין אין הצעות", "No suggestions yet")} /> : <ul className="divide-y divide-border">{notes.map((n) => (
              <li key={n.id} className="py-2.5 text-sm"><p>{n.suggestion}</p><p className="mt-0.5 text-xs text-muted">{n.customerId ? <Link href={`/crm/${n.customerId}`} className="hover:text-gold">{n.name}</Link> : n.name} · {n.rating}★{n.serviceRating ? ` · ${L("שירות", "service")} ${n.serviceRating}★` : ""} · {formatDate(n.createdAt, locale)}</p></li>))}</ul>}
          </Card>
        </>);
      })())}
    </div>
  );
}
