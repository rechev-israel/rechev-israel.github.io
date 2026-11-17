import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/i18n";
import { blocksSchema } from "@/server/sites/blocks";
import { getSessionUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { SiteRenderer } from "@/components/sites/site-renderer";
import { BrandMark, Wordmark } from "@/components/shell/brand";
import { PreferenceToggles } from "@/components/shell/preferences";

export const dynamic = "force-dynamic";

async function load(slug: string, preview: boolean) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) return null;
  const page = await db.sitePage.findUnique({ where: { businessId_slug: { businessId: business.id, slug } } });
  if (!page) return null;
  if (preview) {
    // Drafts are visible only to signed-in staff with marketing rights.
    const u = await getSessionUser();
    if (!u || u.businessId !== business.id || !can(u.role, "marketing.view")) return null;
    const parsed = blocksSchema.safeParse(page.blocks);
    return parsed.success ? { page, business, blocks: parsed.data, title: page.title, preview: true } : null;
  }
  if (page.status !== "published" || !page.publishedBlocks) return null;
  const parsed = blocksSchema.safeParse(page.publishedBlocks);
  return parsed.success ? { page, business, blocks: parsed.data, title: page.publishedTitle ?? page.title, preview: false } : null;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }): Promise<Metadata> {
  const r = await load((await params).slug, (await searchParams).preview === "1");
  if (!r) return { title: "Not found" };
  return {
    title: r.page.seoTitle || r.title,
    description: r.page.seoDescription ?? undefined,
    robots: r.preview ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: r.page.seoTitle || r.title, description: r.page.seoDescription ?? undefined, type: "website" },
  };
}

export default async function PublicSitePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const slug = (await params).slug;
  const r = await load(slug, (await searchParams).preview === "1");
  if (!r) notFound();
  const { t, locale } = await getI18n();
  return (
    <main className="min-h-dvh">
      {r.preview && <div className="sticky top-0 z-50 bg-warning/90 py-1.5 text-center text-xs font-semibold text-black">{locale === "he" ? "תצוגה מקדימה של טיוטה — לא גלוי לציבור" : "Draft preview — not public"}</div>}
      <header className="safe-top mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3"><BrandMark /><Wordmark sub={locale === "he" ? "אשקלון" : "ASHKELON"} /></div>
        <PreferenceToggles locale={locale} t={t} />
      </header>
      <SiteRenderer businessId={r.business.id} blocks={r.blocks} slug={slug} locale={locale} t={t} />
      <footer className="safe-bottom border-t border-border py-6 text-center text-xs text-muted">© CASTEL STUDIO · <a href="/join" className="text-gold">Academy</a></footer>
    </main>
  );
}
