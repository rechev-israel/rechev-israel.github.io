import { db } from "@/lib/db";
import { requireApiUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** Staff see a customer's photo only when the customer chose to share it (or set it as their haircut reference). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(req, "crm.edit");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const p = await db.customerPhoto.findFirst({ where: { id, businessId: auth.user.businessId }, select: { mime: true, data: true, sharedWithBarber: true, customerId: true } });
  const reference = p && !p.sharedWithBarber ? await db.haircutProfile.findFirst({ where: { customerId: p.customerId, photoId: id } }) : null;
  if (!p || (!p.sharedWithBarber && !reference)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(p.data), { headers: { "Content-Type": p.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
