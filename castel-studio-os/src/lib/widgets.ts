export const WIDGET_IDS = ["kpis", "trend", "alerts", "notifications", "upcoming", "tasks", "insights", "academy", "marketing"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];
export function visibleWidgets(pref: unknown): Set<WidgetId> {
  if (!Array.isArray(pref)) return new Set(WIDGET_IDS);
  return new Set(pref.filter((w): w is WidgetId => (WIDGET_IDS as readonly string[]).includes(String(w))));
}
