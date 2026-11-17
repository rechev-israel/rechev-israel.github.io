import { db } from "@/lib/db";

/** Public delivery of APPROVED creative images only (used by published site pages). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return new Response("not found", { status: 404 });
  const a = await db.creativeAsset.findFirst({ where: { id, approval: "approved", status: "succeeded", dataUrl: { not: null }, kind: { in: ["graphic", "image", "image_edit"] } }, select: { dataUrl: true, updatedAt: true } });
  const m = a?.dataUrl ? /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(a.dataUrl) : null;
  if (!m) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
}
