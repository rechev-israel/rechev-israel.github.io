import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { pageGuard } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { createPageAction } from "@/server/actions/sites";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms";
import { Badge, Card, CardTitle, EmptyState, Input, Label, Notice, PageHeader, buttonClass } from "@/components/ui";
import { Forbidden } from "@/components/forbidden";

export const metadata = { title: "Sites" };

export default async function SitesPage() {
  const { user, locale, t, allowed } = await pageGuard("marketing.view");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  const L = (he: string, en: string) => (locale === "he" ? he : en);
  const pages = await db.sitePage.findMany({ where: { businessId: user.businessId }, orderBy: { updatedAt: "desc" } });
  const tone = { published: "success", draft: "neutral", unpublished: "warning" } as const;
  const label: Record<string, string> = { published: L("פורסם", "Published"), draft: L("טיוטה", "Draft"), unpublished: L("הוסר מפרסום", "Unpublished") };
  return (
    <>
      <PageHeader title={t.nav.sites} subtitle={L("דפי נחיתה ואתר מבלוקים — טיוטה, תצוגה מקדימה ופרסום באישור הבעלים", "Landing pages & website from blocks — draft, preview, owner-approved publishing")} />
      <Notice tone="neutral" className="mb-4">{L("דפים מתפרסמים בכתובת /s/<כתובת>. דומיין מותאם (למשל castel.co.il) מחברים ב-Vercel → Settings → Domains ומפנים אליו את כתובת הדף הראשי.", "Pages publish at /s/<slug>. A custom domain (e.g. castel.co.il) is connected in Vercel → Settings → Domains.")}</Notice>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {can(user.role, "marketing.edit") && (
          <Card className="h-fit">
            <CardTitle>{L("דף חדש", "New page")}</CardTitle>
            <ActionForm action={createPageAction} className="space-y-3">
              <div><Label>{t.common.name} *</Label><Input name="title" required placeholder={L("דף הבית", "Home")} /><FieldError name="title" /></div>
              <div><Label>{L("כתובת (באנגלית)", "Slug")} *</Label><Input name="slug" required dir="ltr" placeholder="home" pattern="[a-z0-9-]+" /><FieldError name="slug" /></div>
              <SubmitButton className="w-full">{t.common.create}</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <Card>
          {pages.length === 0 ? <EmptyState title={t.common.empty} /> : (
            <ul className="divide-y divide-border">
              {pages.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/sites/${p.id}`} className="font-medium hover:text-gold">{p.title}</Link>
                    <p className="text-xs text-muted" dir="ltr">/s/{p.slug}</p>
                    <p className="text-[11px] text-muted">{L("עודכן", "Updated")} {formatDateTime(p.updatedAt, locale)}{p.publishedAt ? ` · ${L("פורסם", "published")} ${formatDateTime(p.publishedAt, locale)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={tone[p.status as keyof typeof tone] ?? "neutral"}>{label[p.status] ?? p.status}</Badge>
                    {p.status === "published" && <a href={`/s/${p.slug}`} target="_blank" className={buttonClass("ghost", "sm")}><ExternalLink size={13} /> {L("צפייה", "View")}</a>}
                    <Link href={`/sites/${p.id}`} className={buttonClass("secondary", "sm")}>{t.common.edit}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
