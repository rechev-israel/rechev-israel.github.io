/**
 * WhatsApp message templates (Meta requires pre-approved templates for business-initiated messages).
 * Created in the owner's WhatsApp Business Account from the Integration Center; sent with positional parameters.
 * Rules respected: lowercase names, no parameter at the very start/end, no adjacent parameters.
 */
export type WaTemplate = { name: string; category: "UTILITY" | "MARKETING"; text: string; params: string[]; example: string[] };

export const WA_LANG = "he";

export const WA_TEMPLATES: Record<string, WaTemplate> = {
  booking_confirmation: {
    name: "castel_booking_confirmation", category: "UTILITY",
    text: "היי {{1}}, התור שלך ב-CASTEL STUDIO נקבע ✂️\nשירות: {{2}}\nמתי: {{3}} בשעה {{4}}\nלשינוי או ביטול אפשר להשיב להודעה הזו.",
    params: ["name", "service", "date", "time"], example: ["איליי", "תספורת גבר", "19/11/2026", "16:20"],
  },
  appointment_reminder: {
    name: "castel_appointment_reminder", category: "UTILITY",
    text: "היי {{1}}, תזכורת לתור שלך מחר {{2}} בשעה {{3}} ב-CASTEL STUDIO ({{4}}). אם צריך לשנות, השב להודעה הזו.",
    params: ["name", "date", "time", "service"], example: ["איליי", "19/11/2026", "16:20", "תספורת גבר"],
  },
  post_visit: {
    name: "castel_post_visit", category: "UTILITY",
    text: "תודה {{1}} שביקרת היום ב-CASTEL STUDIO! נשמח לשמוע איך יצא 🙏",
    params: ["name"], example: ["איליי"],
  },
  welcome: {
    name: "castel_welcome", category: "UTILITY",
    text: "היי {{1}}, תודה שבחרת ב-CASTEL STUDIO ✂️ לכל שאלה או לקביעת תור, אנחנו כאן.",
    params: ["name"], example: ["איליי"],
  },
  academy_lead: {
    name: "castel_academy_lead", category: "UTILITY",
    text: "היי {{1}}, קיבלנו את הפנייה שלך לגבי {{2}} 🎓 נחזור אליך בהקדם עם כל הפרטים.",
    params: ["name", "course"], example: ["איליי", "CASTEL STUDIO ACADEMY"],
  },
  academy_payment: {
    name: "castel_academy_payment", category: "UTILITY",
    text: "היי {{1}}, תזכורת ידידותית: נותרה יתרה של {{2}} עבור {{3}}. לכל שאלה אנחנו כאן 🙏",
    params: ["name", "balance", "course"], example: ["איליי", "₪1,000", "הקורס הקבוצתי"],
  },
  birthday: {
    name: "castel_birthday", category: "MARKETING",
    text: "מזל טוב {{1}}! 🎉 לכבוד יום ההולדת מחכה לך הטבה מיוחדת בתור הבא ב-CASTEL STUDIO. להסרה השב \"הסר\".",
    params: ["name"], example: ["איליי"],
  },
};

export function templateComponents(key: string, vars: Record<string, unknown>) {
  const t = WA_TEMPLATES[key];
  if (!t) return null;
  // Meta rejects empty parameters: fall back to a neutral value.
  return [{ type: "body", parameters: t.params.map((p) => ({ type: "text", text: String(vars[p] ?? "").trim() || (p === "name" ? "לקוח" : "-") })) }];
}
