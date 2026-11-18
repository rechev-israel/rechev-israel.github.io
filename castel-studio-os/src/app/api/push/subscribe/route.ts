import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/server/auth/session";
import { audit } from "@/server/audit";

const schema = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "https only"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Save this device's push subscription (owner / manager only). */
export async function POST(req: Request) {
  const r = await requireApiUser(req);
  if ("error" in r) return r.error;
  if (r.user.role !== "OWNER" && r.user.role !== "MANAGER") return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 422 });
  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { businessId: r.user.businessId, userId: r.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null },
    update: { businessId: r.user.businessId, userId: r.user.id, p256dh: keys.p256dh, auth: keys.auth, failures: 0, lastError: null },
  });
  await audit({ businessId: r.user.businessId, userId: r.user.id, action: "push.subscribe", entityType: "PushSubscription" });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const r = await requireApiUser(req);
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: r.user.id } });
  return Response.json({ ok: true });
}
