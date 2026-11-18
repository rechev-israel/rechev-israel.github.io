import webpush from "web-push";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Web Push (VAPID). Keys live only in Vercel env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
 * Works on Android/desktop browsers and on iPhone when the app is added to the Home Screen (iOS 16.4+).
 */
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY?.trim() ?? "";

let ready = false;
function init() {
  if (ready || !pushConfigured()) return pushConfigured();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:owner@castel.studio", process.env.VAPID_PUBLIC_KEY!.trim(), process.env.VAPID_PRIVATE_KEY!.trim());
  ready = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Send to every subscribed device of the given users. Expired subscriptions are removed. Returns per-device results. */
export async function sendPush(businessId: string, userIds: string[] | null, payload: PushPayload) {
  if (!init()) return { configured: false, sent: 0, failed: 0 };
  const subs = await db.pushSubscription.findMany({ where: { businessId, ...(userIds ? { userId: { in: userIds } } : {}) } });
  let sent = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: "high", topic: payload.tag?.slice(0, 32) });
      sent++;
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: new Date(), lastError: null, failures: 0 } });
    } catch (e) {
      failed++;
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else await db.pushSubscription.update({ where: { id: s.id }, data: { lastError: `${code ?? ""} ${String((e as Error).message ?? e)}`.slice(0, 300), failures: { increment: 1 } } }).catch(() => {});
      logger.warn("push.failed", { code });
    }
  }));
  return { configured: true, sent, failed };
}
