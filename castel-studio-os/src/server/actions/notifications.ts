"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { sendPush, pushConfigured } from "@/server/notify/push";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";

/** Sends a real push to this user's subscribed devices and reports what the push services answered. */
export async function sendTestPushAction(_: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (!pushConfigured()) return { error: "VAPID keys are not configured on the server." };
    const devices = await db.pushSubscription.count({ where: { userId: user.id } });
    if (!devices) return { error: "אין מכשיר רשום. לחצו קודם על ״הפעלת התראות במכשיר הזה״." };
    const r = await sendPush(user.businessId, [user.id], { title: "CASTEL STUDIO · בדיקת התראה", body: "אם אתה רואה את זה, התראות לטלפון עובדות ✓", url: "/notifications", tag: "test" });
    if (!r.sent) return { error: `שירות ההתראות דחה את השליחה (${r.failed} מכשירים). נסו להפעיל מחדש במכשיר.` };
    return { ok: true, message: `נשלח ל-${r.sent} מכשירים${r.failed ? ` · ${r.failed} נכשלו` : ""}. בדקו שההתראה הגיעה.` };
  });
}
