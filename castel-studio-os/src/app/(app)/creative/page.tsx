import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { aiConfigured } from "@/server/ai/provider";
import { providerFor, requiredEnvFor, type CreativeKind } from "@/server/creative/providers";
import { refreshCreativeJobs } from "@/server/creative/service";
import { createCreativeJobAction, creativeApprovalAction, deleteCreativeAction, refreshCreativeAction, retryCreativeJobAction, saveBrandKitAction, writePromptAction } from "@/server/actions/creative";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, Select, Textarea, buttonClass } from "@/components/ui";
import { GraphicDesignerWithSave } from "@/components/creative/save-bridge";
import { PromptWriter } from "@/components/creative/prompt-writer";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Creative Studio" };
export const dynamic = "force-dynamic";
const TABS = ["design", "generate", "library", "brand"] as const;
const KINDS: CreativeKind[] = ["image", "image_edit", "video", "animation", "model3d", "voiceover"];

export default async function CreativePage({ searchParams }: { searchParams: Promise<{ tab?: string; kind?: string }> }) {
  const { user, locale, t, allowed } = await pageGuard("creative.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "design";
  const edit = can(user.role, "creative.edit");
  if (tab === "library") await refreshCreativeJobs(user.businessId, 10).catch(() => 0);
  const kit = (await db.brandKit.findUnique({ where: { businessId: user.businessId } })) ?? { displayName: "CASTEL STUDIO", tagline: L("ספרות גברים · אשקלון", "Men's grooming · Ashkelon"), primaryColor: "#0a0a0b", accentColor: "#c9a44c", textColor: "#f2ede3", voiceTone: null, visualStyle: null, hashtags: [] as string[], handle: "@castel.cutzz" };
  const assets = tab === "library" ? await db.creativeAsset.findMany({ where: { businessId: user.businessId, status: { not: "cancelled_retry" }, ...(sp.kind ? { kind: sp.kind } : {}) }, orderBy: { createdAt: "desc" }, take: 60 }) : [];
  const kindLabel: Record<string, string> = { graphic: L("גרפיקה", "Graphic"), image: L("תמונה", "Image"), image_edit: L("עריכת תמונה", "Image edit"), video: L("וידאו", "Video"), animation: L("אנימציה (תמונה→וידאו)", "Animation (image→video)"), model3d: L("מודל תלת-ממד", "3D model"), voiceover: L("קריינות", "Voice-over") };
  const statusTone = { succeeded: "success", processing: "info", queued: "info", failed: "danger", pending_config: "warning" } as const;
  const statusLabel: Record<string, string> = { succeeded: L("מוכן", "Ready"), processing: L("בעיבוד", "Processing"), queued: L("בתור", "Queued"), failed: L("נכשל", "Failed"), pending_config: L("ממתין להגדרת ספק", "Pending provider config") };
  const approvalLabel: Record<string, string> = { draft: L("טיוטה", "Draft"), pending_approval: L("ממתין לאישור", "Pending approval"), approved: L("מאושר לשימוש", "Approved"), rejected: L("נדחה", "Rejected") };
  const tabLabel = { design: L("עיצוב גרפי", "Design"), generate: L("יצירה עם AI", "AI generate"), library: L("ספריית נכסים", "Asset library"), brand: L("ערכת מותג", "Brand kit") };

  return (
    <>
      <PageHeader title={t.nav.creative} subtitle={L("עיצוב פוסטים וסטוריז במותג, יצירת תמונות/וידאו/תלת-ממד/קריינות עם ספקי AI, וספריית נכסים עם אישור לפני שימוש", "Branded posts & stories, AI image/video/3D/voice generation, and an asset library with approval before use")} />
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((k) => <Link key={k} href={`/creative?tab=${k}`} className={buttonClass(tab === k ? "outline" : "ghost", "sm", "shrink-0")}>{tabLabel[k]}</Link>)}
      </nav>

      {tab === "design" && (
        <Card>
          <CardTitle action={<Badge tone="success">{L("פעיל — ללא ספק חיצוני", "Active — no external provider")}</Badge>}>{tabLabel.design}</CardTitle>
          {edit ? (
            <GraphicDesignerWithSave brand={kit} labels={{
              template: L("תבנית", "Template"), size: L("גודל", "Size"), tPromo: L("מבצע", "Promotion"), tAcademy: L("אקדמיה", "Academy"), tQuote: L("ציטוט / ביקורת", "Quote / review"), tAnnounce: L("הודעה / אירוע", "Announcement"),
              headline: L("כותרת", "Headline"), body: L("טקסט", "Text"), badge: L("תג (מחיר/תאריך)", "Badge (price/date)"), cta: L("כפתור קריאה לפעולה", "Call to action"),
              bgAdd: L("הוספת תמונת רקע", "Add background photo"), bgChange: L("החלפת תמונת רקע", "Change background"), bgRemove: L("הסרת רקע", "Remove background"),
              save: L("שמירה לספרייה", "Save to library"), saved: L("נשמר בספרייה", "Saved to library"),
              defHeadline: L("תספורת + זקן", "Haircut + Beard"), defBody: L("חוויית טיפוח פרימיום באשקלון. קובעים תור בקישור בביו.", "Premium grooming in Ashkelon. Book via the link in bio."), defBadge: "₪140", defCta: L("קביעת תור", "Book now"),
              acHeadline: L("קורס ספרות גברים", "Men's Barbering Course"), acBody: L("6 מפגשים · 12 שעות הדרכה · עד 5 תלמידים", "6 lessons · 12 hours · max 5 students"), acBadge: "₪5,500", acCta: L("הרשמה לקורס", "Enroll now"),
              qHeadline: L("\"השירות הכי מקצועי שקיבלתי\"", "\"The most professional service I've had\""), qBody: L("— לקוח מרוצה", "— Happy client"),
              anHeadline: L("שעות פעילות לחג", "Holiday hours"), anBody: L("ביום שישי פתוחים 08:00–14:00", "Open Friday 08:00–14:00"), anBadge: "", anCta: L("לפרטים בוואטסאפ", "Details on WhatsApp"),
            }} />
          ) : <Notice tone="neutral">{t.errors.forbidden}</Notice>}
        </Card>
      )}

      {tab === "generate" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardTitle>{tabLabel.generate}</CardTitle>
            <PromptWriter action={writePromptAction} enabled={aiConfigured() && edit} labels={{ image: kindLabel.image, video: kindLabel.video, animation: L("אנימציה", "Animation"), voiceover: kindLabel.voiceover, placeholder: L("רעיון: פוסט לפייד חדש עם תאורה דרמטית", "Idea: dramatic-light shot of a fresh fade"), write: L("כתיבת פרומפט עם AI", "Write prompt with AI"), disabled: L("כתיבת פרומפט דורשת ANTHROPIC_API_KEY.", "Prompt writing requires ANTHROPIC_API_KEY.") }} />
            {edit && (
              <ActionForm action={createCreativeJobAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><Label>{L("סוג", "Type")}</Label><Select name="kind" defaultValue={sp.kind && KINDS.includes(sp.kind as CreativeKind) ? sp.kind : "image"}>{KINDS.map((k) => <option key={k} value={k}>{kindLabel[k]}{providerFor(k) ? "" : ` — ${L("לא מוגדר", "not configured")}`}</option>)}</Select></div>
                <div><Label>{L("שם הנכס", "Asset name")} *</Label><Input name="title" required maxLength={120} /><FieldError name="title" /></div>
                <div className="sm:col-span-2"><Label>{L("פרומפט / תסריט קריינות", "Prompt / voice-over script")} *</Label><Textarea name="prompt" rows={5} required /><FieldError name="prompt" /></div>
                <div className="sm:col-span-2"><Label>{L("קישור לתמונת מקור (לעריכה / אנימציה / תלת-ממד)", "Source image URL (edit / animation / 3D)")}</Label><Input name="imageUrl" type="url" dir="ltr" placeholder="https://" /><FieldError name="imageUrl" /></div>
                <details className="sm:col-span-2"><summary className="cursor-pointer text-xs text-muted">{L("מתקדם: פרמטרים נוספים לספק (JSON)", "Advanced: extra provider input (JSON)")}</summary><Textarea name="extraInput" rows={3} dir="ltr" placeholder='{"aspect_ratio": "9:16", "duration": 5}' className="mt-2 font-mono text-xs" /><FieldError name="extraInput" /></details>
                <div className="sm:col-span-2 flex justify-end"><SubmitButton>{L("יצירה", "Generate")}</SubmitButton></div>
              </ActionForm>
            )}
          </Card>
          <Card>
            <CardTitle>{L("ספקים", "Providers")}</CardTitle>
            <ul className="space-y-2 text-sm">
              {KINDS.map((k) => {
                const p = providerFor(k);
                return (
                  <li key={k} className="rounded-lg bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2"><span>{kindLabel[k]}</span><Badge tone={p ? "success" : "warning"}>{p ?? L("ממתין להגדרה", "Pending config")}</Badge></div>
                    {!p && <p className="mt-1 text-[11px] text-muted" dir="ltr">{requiredEnvFor(k).join(" + ")}</p>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-muted">{L("Replicate מאפשר לבחור מודל לכל סוג (למשל מודל וידאו או תלת-ממד) דרך משתני הסביבה REPLICATE_MODEL_*. תוצרים לא ייחשבו מוכנים עד שהספק מחזיר תוצאה אמיתית.", "Replicate lets you choose a model per type via REPLICATE_MODEL_* env vars. Nothing is marked ready until the provider returns a real result.")}</p>
          </Card>
        </div>
      )}

      {tab === "library" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link href="/creative?tab=library" className={buttonClass(!sp.kind ? "outline" : "ghost", "sm")}>{t.common.all}</Link>
            {["graphic", ...KINDS].map((k) => <Link key={k} href={`/creative?tab=library&kind=${k}`} className={buttonClass(sp.kind === k ? "outline" : "ghost", "sm")}>{kindLabel[k]}</Link>)}
            <InlineAction action={refreshCreativeAction} variant="ghost"><RefreshCw size={13} /> {L("רענון סטטוס", "Refresh status")}</InlineAction>
          </div>
          {assets.length === 0 ? <EmptyState title={t.common.empty} /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {assets.map((a) => {
                const src = a.dataUrl ?? a.outputUrl;
                const mime = a.mimeType ?? "";
                const temp = (a.meta as { temporaryUrl?: boolean } | null)?.temporaryUrl;
                return (
                  <Card key={a.id} className="flex flex-col p-3">
                    <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                      {a.status !== "succeeded" || !src ? <span className="px-3 text-center text-xs text-muted">{statusLabel[a.status] ?? a.status}</span>
                        : mime.startsWith("video") || a.kind === "video" || a.kind === "animation" ? <video src={src} controls playsInline className="h-full w-full object-contain" />
                        : mime.startsWith("audio") || a.kind === "voiceover" ? <audio src={src} controls className="w-full px-2" />
                        : a.kind === "model3d" ? <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-gold underline">{L("הורדת קובץ תלת-ממד", "Download 3D file")}</a>
                        : <img src={src} alt={a.title} className="h-full w-full object-contain" loading="lazy" />}
                    </div>
                    <div className="flex flex-wrap gap-1"><Badge>{kindLabel[a.kind] ?? a.kind}</Badge><Badge tone={statusTone[a.status as keyof typeof statusTone] ?? "neutral"}>{statusLabel[a.status] ?? a.status}</Badge>{a.status === "succeeded" && <Badge tone={a.approval === "approved" ? "success" : a.approval === "rejected" ? "danger" : a.approval === "pending_approval" ? "gold" : "neutral"}>{approvalLabel[a.approval]}</Badge>}</div>
                    <p className="mt-1 truncate text-sm font-medium" title={a.title}>{a.title}</p>
                    <p className="text-[10px] text-muted">{a.provider}{a.model ? ` · ${a.model}` : ""} · {formatDateTime(a.createdAt, locale)}</p>
                    {a.error && <p className="mt-1 line-clamp-2 text-[11px] text-danger">{a.error}</p>}
                    {temp && <p className="mt-1 text-[11px] text-warning">{L("קובץ גדול בקישור זמני אצל הספק — הורידו בהקדם.", "Large file on a temporary provider link — download soon.")}</p>}
                    <div className="mt-auto flex flex-wrap gap-1 pt-2">
                      {src && a.status === "succeeded" && <a href={src} download={`castel-${a.id}`} className={buttonClass("ghost", "sm")}>{L("הורדה", "Download")}</a>}
                      {edit && a.status === "succeeded" && (a.approval === "draft" || a.approval === "rejected") && <InlineAction action={creativeApprovalAction} fields={{ id: a.id, op: "submit" }} variant="outline">{L("לאישור", "Submit")}</InlineAction>}
                      {can(user.role, "approvals.decide") && a.status === "succeeded" && a.approval !== "approved" && <InlineAction action={creativeApprovalAction} fields={{ id: a.id, op: "approve" }} variant="primary">{L("אישור", "Approve")}</InlineAction>}
                      {can(user.role, "approvals.decide") && a.approval === "pending_approval" && <InlineAction action={creativeApprovalAction} fields={{ id: a.id, op: "reject" }}>{L("דחייה", "Reject")}</InlineAction>}
                      {edit && (a.status === "pending_config" || a.status === "failed") && <InlineAction action={retryCreativeJobAction} fields={{ id: a.id }} variant="outline">{L("ניסיון חוזר", "Retry")}</InlineAction>}
                      {edit && a.approval !== "approved" && <InlineAction action={deleteCreativeAction} fields={{ id: a.id }} confirm={t.common.delete + "?"}>✕</InlineAction>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "brand" && (
        <Card className="max-w-3xl">
          <CardTitle>{tabLabel.brand}</CardTitle>
          <ActionForm action={saveBrandKitAction} className="grid gap-3 sm:grid-cols-2">
            <div><Label>{L("שם המותג", "Brand name")}</Label><Input name="displayName" defaultValue={kit.displayName} disabled={!edit} /></div>
            <div><Label>{L("סלוגן", "Tagline")}</Label><Input name="tagline" defaultValue={kit.tagline ?? ""} disabled={!edit} /></div>
            <div><Label>{L("צבע רקע", "Background")}</Label><Input name="primaryColor" type="color" defaultValue={kit.primaryColor} disabled={!edit} className="h-11 p-1" /></div>
            <div><Label>{L("צבע זהב/הדגשה", "Accent")}</Label><Input name="accentColor" type="color" defaultValue={kit.accentColor} disabled={!edit} className="h-11 p-1" /></div>
            <div><Label>{L("צבע טקסט", "Text colour")}</Label><Input name="textColor" type="color" defaultValue={kit.textColor} disabled={!edit} className="h-11 p-1" /></div>
            <div><Label>{L("שם משתמש ברשתות", "Social handle")}</Label><Input name="handle" defaultValue={kit.handle ?? ""} dir="ltr" disabled={!edit} /></div>
            <div className="sm:col-span-2"><Label>{L("טון דיבור (לסוכני AI)", "Voice & tone (for AI agents)")}</Label><Textarea name="voiceTone" rows={2} defaultValue={kit.voiceTone ?? ""} disabled={!edit} /></div>
            <div className="sm:col-span-2"><Label>{L("סגנון ויזואלי (לפרומפטים)", "Visual style (for prompts)")}</Label><Textarea name="visualStyle" rows={2} defaultValue={kit.visualStyle ?? ""} disabled={!edit} /></div>
            <div className="sm:col-span-2"><Label>{L("האשטאגים קבועים", "Default hashtags")}</Label><Input name="hashtags" defaultValue={kit.hashtags.join(" ")} dir="ltr" disabled={!edit} /></div>
            {edit && <div className="sm:col-span-2 flex justify-end"><SubmitButton>{t.common.save}</SubmitButton></div>}
          </ActionForm>
        </Card>
      )}
    </>
  );
}
