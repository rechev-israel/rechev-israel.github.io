"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { getI18n } from "@/i18n";
import { blocksSchema, defaultBlocks, pageMetaSchema, RESERVED_SLUGS, type Block } from "@/server/sites/blocks";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

/** Images on a page must be APPROVED creative assets of this business. */
async function assertApprovedAssets(businessId: string, blocks: Block[]) {
  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.type === "hero" && b.imageAssetId) ids.add(b.imageAssetId);
    if (b.type === "gallery") b.assetIds.forEach((x) => ids.add(x));
  }
  if (!ids.size) return;
  const ok = await db.creativeAsset.count({ where: { businessId, id: { in: [...ids] }, approval: "approved", dataUrl: { not: null } } });
  if (ok !== ids.size) throw new Error("only approved images can be used");
}

export async function createPageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async (): Promise<ActionState | void> => {
    const user = await requireUser("marketing.edit");
    const { locale } = await getI18n();
    const meta = pageMetaSchema.pick({ title: true, slug: true }).parse({ title: fd.get("title"), slug: fd.get("slug") });
    if (RESERVED_SLUGS.has(meta.slug)) return { error: "slug", fieldErrors: { slug: locale === "he" ? "כתובת שמורה" : "reserved slug" } };
    try {
      const p = await db.sitePage.create({ data: { businessId: user.businessId, title: meta.title, slug: meta.slug, blocks: defaultBlocks(locale === "he") } });
      id = p.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "slug", fieldErrors: { slug: locale === "he" ? "הכתובת כבר בשימוש" : "slug already used" } };
      throw e;
    }
    await audit({ businessId: user.businessId, userId: user.id, action: "site.create", entityType: "SitePage", entityId: id });
  });
  if (id) redirect(`/sites/${id}`);
  return res;
}

export async function savePageDraftAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const user = await requireUser("marketing.edit");
    const meta = pageMetaSchema.omit({ slug: true }).parse({ title: fd.get("title"), seoTitle: fd.get("seoTitle") || undefined, seoDescription: fd.get("seoDescription") || undefined });
    let raw: unknown;
    try { raw = JSON.parse(String(fd.get("blocks") ?? "[]")); } catch { return { error: "JSON" }; }
    const blocks = blocksSchema.parse(raw);
    await assertApprovedAssets(user.businessId, blocks);
    const r = await db.sitePage.updateMany({ where: { id, businessId: user.businessId }, data: { title: meta.title, seoTitle: meta.seoTitle ?? null, seoDescription: meta.seoDescription ?? null, blocks } });
    if (!r.count) throw new Error("not found");
    await audit({ businessId: user.businessId, userId: user.id, action: "site.save_draft", entityType: "SitePage", entityId: id });
    revalidatePath(`/sites/${id}`);
  });
}

/** Publishing is an external action → owner only. Copies the validated draft to the live version. */
export async function publishPageAction(fd: FormData) {
  const user = await requireUser("approvals.decide");
  const id = String(fd.get("id"));
  const page = await db.sitePage.findFirst({ where: { id, businessId: user.businessId } });
  if (!page) return;
  const blocks = blocksSchema.parse(page.blocks);
  await assertApprovedAssets(user.businessId, blocks);
  await db.sitePage.update({ where: { id }, data: { publishedBlocks: blocks, publishedTitle: page.title, status: "published", publishedAt: new Date(), publishedById: user.id } });
  await audit({ businessId: user.businessId, userId: user.id, action: "site.publish", entityType: "SitePage", entityId: id, metadata: { slug: page.slug } });
  revalidatePath(`/sites/${id}`); revalidatePath("/sites"); revalidatePath(`/s/${page.slug}`);
}

export async function unpublishPageAction(fd: FormData) {
  const user = await requireUser("approvals.decide");
  const id = String(fd.get("id"));
  const r = await db.sitePage.updateMany({ where: { id, businessId: user.businessId }, data: { status: "unpublished" } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "site.unpublish", entityType: "SitePage", entityId: id });
  revalidatePath(`/sites/${id}`); revalidatePath("/sites");
}

export async function deletePageAction(fd: FormData) {
  const user = await requireUser("marketing.edit");
  const r = await db.sitePage.deleteMany({ where: { id: String(fd.get("id")), businessId: user.businessId, status: { not: "published" } } });
  if (r.count) await audit({ businessId: user.businessId, userId: user.id, action: "site.delete", entityType: "SitePage" });
  revalidatePath("/sites");
  redirect("/sites");
}
