"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { generateWithAgent } from "@/server/ai/orchestrator";
import { getI18n } from "@/i18n";
import type { ActionState } from "@/lib/validation";
import { runAction } from "./util";
import { WIDGET_IDS } from "@/lib/widgets";

export async function saveWidgetsAction(fd: FormData) {
  const user = await requireUser("dashboard.view");
  const chosen = fd.getAll("w").map(String).filter((w) => (WIDGET_IDS as readonly string[]).includes(w));
  await db.user.update({ where: { id: user.id }, data: { dashboardWidgets: chosen } });
  revalidatePath("/dashboard");
}

export async function generateInsightsAction(_: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser("ai.use");
    const { locale } = await getI18n();
    const L = (he: string, en: string) => (locale === "he" ? he : en);
    const r = await generateWithAgent({
      user, agent: "ceo", locale, title: "Dashboard insights",
      task: L(
        "נתח את נתוני העסק שסופקו ותן 5 תובנות והמלצות פעולה קונקרטיות לשבוע הקרוב (כל אחת בשורה-שתיים). התבסס רק על הנתונים; אם חסרים נתונים — ציין מה כדאי לתעד.",
        "Analyse the business data provided and give 5 concrete insights and actions for the coming week (1–2 lines each). Use only the data; if data is missing, say what to record.",
      ),
    });
    if (!r.configured) return { error: L("ספק AI לא מוגדר (ANTHROPIC_API_KEY).", "No AI provider configured (ANTHROPIC_API_KEY).") };
    if (!r.text) return { error: L("שגיאה בקבלת תשובה מהספק", "Error getting a response from the provider") };
    await db.notification.create({ data: { businessId: user.businessId, userId: user.id, kind: "ai_insight", level: "info", title: L("תובנות AI", "AI insights"), body: r.text, link: "/agents" } });
    revalidatePath("/dashboard");
  });
}
