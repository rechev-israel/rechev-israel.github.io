/** Built-in message templates (Hebrew + English). Placeholders: {{name}}, {{date}}, {{time}}, {{service}}, {{course}}, {{business}}. */
export type TemplateDef = { key: string; purpose: "transactional" | "marketing"; name: { he: string; en: string }; subject?: { he: string; en: string }; body: { he: string; en: string } };

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  {
    key: "welcome",
    purpose: "transactional",
    name: { he: "ברוכים הבאים", en: "Welcome" },
    subject: { he: "ברוכים הבאים ל-CASTEL STUDIO", en: "Welcome to CASTEL STUDIO" },
    body: {
      he: "היי {{name}}, תודה שבחרת ב-CASTEL STUDIO ✂️ שמחים שאתה איתנו. לכל שאלה או לקביעת תור — אנחנו כאן.",
      en: "Hi {{name}}, thanks for choosing CASTEL STUDIO ✂️ We're glad to have you. For any question or booking — we're here.",
    },
  },
  {
    key: "appointment_reminder",
    purpose: "transactional",
    name: { he: "תזכורת לתור", en: "Appointment reminder" },
    subject: { he: "תזכורת לתור מחר", en: "Your appointment tomorrow" },
    body: {
      he: "היי {{name}}, תזכורת לתור שלך מחר {{date}} בשעה {{time}} ב-CASTEL STUDIO ({{service}}). אם צריך לשנות — השב להודעה זו.",
      en: "Hi {{name}}, a reminder of your appointment tomorrow {{date}} at {{time}} at CASTEL STUDIO ({{service}}). Need to change it? Reply to this message.",
    },
  },
  {
    key: "post_visit",
    purpose: "transactional",
    name: { he: "תודה אחרי ביקור", en: "Post-visit thank you" },
    subject: { he: "תודה שביקרת ב-CASTEL STUDIO", en: "Thanks for visiting CASTEL STUDIO" },
    body: {
      he: "תודה {{name}} שביקרת היום ב-CASTEL STUDIO! נשמח לשמוע איך יצא 🙏 ואם נהנית — ביקורת קצרה תעזור לנו מאוד.",
      en: "Thanks {{name}} for visiting CASTEL STUDIO today! We'd love to hear how it went 🙏 and if you enjoyed it, a short review helps a lot.",
    },
  },
  {
    key: "academy_lead",
    purpose: "transactional",
    name: { he: "מענה לליד אקדמיה", en: "Academy lead reply" },
    subject: { he: "CASTEL STUDIO ACADEMY — קיבלנו את הפנייה", en: "CASTEL STUDIO ACADEMY — we got your request" },
    body: {
      he: "היי {{name}}, קיבלנו את הפנייה שלך לגבי {{course}} 🎓 נחזור אליך בהקדם עם כל הפרטים ותאריכי המחזור הקרוב.",
      en: "Hi {{name}}, we received your request about {{course}} 🎓 We'll get back to you soon with all details and the next cohort dates.",
    },
  },
  {
    key: "academy_payment",
    purpose: "transactional",
    name: { he: "תזכורת תשלום — אקדמיה", en: "Academy payment reminder" },
    subject: { he: "CASTEL STUDIO ACADEMY — יתרת תשלום", en: "CASTEL STUDIO ACADEMY — balance due" },
    body: {
      he: "היי {{name}}, תזכורת ידידותית: נותרה יתרה של {{balance}} עבור {{course}}. לכל שאלה על אמצעי התשלום — אנחנו כאן 🙏",
      en: "Hi {{name}}, a friendly reminder: a balance of {{balance}} remains for {{course}}. Any questions about payment — we're here 🙏",
    },
  },
  {
    key: "birthday",
    purpose: "marketing",
    name: { he: "יום הולדת", en: "Birthday" },
    subject: { he: "מזל טוב מ-CASTEL STUDIO 🎉", en: "Happy birthday from CASTEL STUDIO 🎉" },
    body: {
      he: "מזל טוב {{name}}! 🎉 לכבוד יום ההולדת מחכה לך הטבה מיוחדת בתור הבא ב-CASTEL STUDIO. להסרה מרשימת הדיוור השב \"הסר\".",
      en: "Happy birthday {{name}}! 🎉 A special gift awaits on your next visit to CASTEL STUDIO. Reply STOP to opt out.",
    },
  },
];

export function renderTemplate(text: string, vars: Record<string, string | number | null | undefined>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? "" : String(v);
  }).replace(/\s+\(\)/g, "").replace(/ {2,}/g, " ").trim();
}
