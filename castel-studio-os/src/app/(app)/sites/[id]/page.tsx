import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Globe, Trash2 } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { blocksSchema } from "@/server/sites/blocks";
import { deletePageAction, publishPageAction, savePageDraftAction, unpublishPageAction } from "@/server/actions/sites";
import { ActionForm, FieldError, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, Input, Label, Notice, PageHeader, Textarea, buttonClass } from "@/components/ui";
import { BlockEditor } from "@/components/sites/block-editor";
import { Forbidden } from "@/components/forbidden";

export default async function SiteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, locale, t, allowed } = await pageGuard("marketing.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const { id } = await params;
  const page = await db.sitePage.findFirst({ where: { id, businessId: user.businessId } });
  if (!page) notFound();
  const assets = await db.creativeAsset.findMany({ where: { businessId: user.businessId, approval: "approved", dataUrl: { not: null }, kind: { in: ["graphic", "image", "image_edit"] } }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 60 });
  const parsed = blocksSchema.safeParse(page.blocks);
  const edit = can(user.role, "marketing.edit");
  const owner = can(user.role, "approvals.decide");
  const draftDiffers = JSON.stringify(page.blocks) !== JSON.stringify(page.publishedBlocks) || page.title !== page.publishedTitle;
  return (
    <>
      <Link href="/sites" className="mb-2 inline-flex min-h-9 items-center text-xs text-muted hover:text-gold">← {t.nav.sites}</Link>
      <PageHeader
        title={page.title}
        subtitle={`/s/${page.slug}`}
        actions={<>
          <Badge tone={page.status === "published" ? "success" : "neutral"} className="h-8 px-3">{page.status === "published" ? L("פורסם", "Published") : page.status === "unpublished" ? L("הוסר מפרסום", "Unpublished") : L("טיוטה", "Draft")}</Badge>
          <a href={`/s/${page.slug}?preview=1`} target="_blank" className={buttonClass("secondary")}><Eye size={14} /> {L("תצוגה מקדימה", "Preview")}</a>
          {owner && <InlineAction action={publishPageAction} fields={{ id: page.id }} variant="primary" size="md" confirm={L("לפרסם את הטיוטה הנוכחית לציבור?", "Publish the current draft publicly?")}><Globe size={14} /> {L("פרסום", "Publish")}</InlineAction>}
          {owner && page.status === "published" && <InlineAction action={unpublishPageAction} fields={{ id: page.id }} size="md">{L("הסרה מפרסום", "Unpublish")}</InlineAction>}
          {edit && page.status !== "published" && <InlineAction action={deletePageAction} fields={{ id: page.id }} variant="danger" size="md" confirm={t.common.delete + "?"}><Trash2 size={14} /></InlineAction>}
        </>}
      />
      {page.status === "published" && draftDiffers && <Notice tone="warning" className="mb-4">{L("יש שינויים בטיוטה שעדיין לא פורסמו.", "The draft has unpublished changes.")}</Notice>}
      {!owner && <Notice tone="neutral" className="mb-4">{L("פרסום לציבור — באישור הבעלים בלבד.", "Publishing is owner-only.")}</Notice>}
      {page.publishedAt && <p className="mb-3 text-xs text-muted">{L("פורסם לאחרונה", "Last published")}: {formatDateTime(page.publishedAt, locale)}</p>}
      <Card className="max-w-4xl">
        <ActionForm action={savePageDraftAction.bind(null, page.id)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>{t.common.name} *</Label><Input name="title" defaultValue={page.title} required disabled={!edit} /><FieldError name="title" /></div>
            <div><Label>{L("כותרת SEO (עד 70 תווים)", "SEO title (≤70)")}</Label><Input name="seoTitle" defaultValue={page.seoTitle ?? ""} maxLength={70} disabled={!edit} /></div>
            <div className="sm:col-span-2"><Label>{L("תיאור SEO (עד 170 תווים)", "SEO description (≤170)")}</Label><Textarea name="seoDescription" defaultValue={page.seoDescription ?? ""} maxLength={170} rows={2} disabled={!edit} /></div>
          </div>
          <CardTitle>{L("בלוקים", "Blocks")}</CardTitle>
          {parsed.success ? (
            <BlockEditor initial={parsed.data as never} assets={assets} labels={{
              b_hero: L("כותרת ראשית", "Hero"), b_services: L("שירותים ומחירים (חי)", "Services & prices (live)"), b_academy: L("קורסי האקדמיה (חי)", "Academy courses (live)"), b_gallery: L("גלריה", "Gallery"), b_text: L("טקסט", "Text"), b_testimonials: L("המלצות", "Testimonials"), b_cta: L("קריאה לפעולה", "Call to action"), b_booking: L("קביעת תור (מערכת התורים)", "Online booking"), b_leadForm: L("טופס לידים", "Lead form"), b_contact: L("יצירת קשר", "Contact"),
              title: L("כותרת", "Title"), subtitle: L("תת-כותרת", "Subtitle"), body: L("טקסט", "Text"), buttonText: L("טקסט כפתור", "Button text"), link: L("קישור (https:// או /…)", "Link (https:// or /…)"), image: L("תמונת רקע (נכס מאושר)", "Background (approved asset)"),
              showPrices: L("הצגת מחירים", "Show prices"), leadKind: L("סוג ליד", "Lead type"), kindShop: L("מספרה", "Barbershop"), kindAcademy: L("אקדמיה", "Academy"), phone: t.common.phone, address: L("כתובת", "Address"), hours: L("שעות פעילות", "Opening hours"),
              images: L("בחירת תמונות מאושרות", "Pick approved images"), noAssets: L("אין עדיין נכסים מאושרים — אשרו תמונות בסטודיו הקריאייטיב.", "No approved assets yet — approve images in the Creative Studio."), quote: L("ציטוט", "Quote"), author: L("שם", "Name"), addTestimonial: L("הוספת המלצה", "Add testimonial"), addBlock: L("הוספת בלוק", "Add block"), remove: t.common.delete,
            }} />
          ) : <Notice tone="danger">invalid blocks</Notice>}
          {edit && <div className="flex justify-end"><SubmitButton>{L("שמירת טיוטה", "Save draft")}</SubmitButton></div>}
        </ActionForm>
      </Card>
    </>
  );
}
