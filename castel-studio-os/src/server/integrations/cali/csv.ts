import { parseLocalDateTime } from "@/lib/dates";
import { parseCsv } from "@/server/integrations/external-booking";
import type { CaliEvent } from "./sync";

/**
 * Convert a booking CSV into normalised Cali events.
 * Supported headers (case-insensitive, Hebrew or English):
 *  id/מזהה, date/תאריך, time/שעה, name/שם, phone/טלפון, email, service/שירות, price/מחיר, status/סטטוס, duration/משך, staff/ספר
 * Rows without an id get a deterministic key from date+time+phone/name, so re-importing the same file never duplicates.
 */
const ALIASES: Record<string, string[]> = {
  id: ["id", "appointment_id", "booking_id", "מזהה"],
  date: ["date", "תאריך"],
  time: ["time", "שעה", "start_time"],
  name: ["name", "customer", "client", "שם", "לקוח"],
  phone: ["phone", "mobile", "טלפון", "נייד"],
  email: ["email", "mail", "אימייל"],
  service: ["service", "treatment", "שירות", "טיפול"],
  price: ["price", "amount", "מחיר", "סכום"],
  status: ["status", "סטטוס", "מצב"],
  duration: ["duration", "minutes", "משך"],
  staff: ["staff", "barber", "employee", "ספר", "עובד"],
};

export function csvToCaliEvents(text: string): { events: CaliEvent[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { events: [], errors: ["empty file"] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (k: string) => header.findIndex((h) => ALIASES[k].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)])) as Record<string, number>;
  if (idx.date < 0 || idx.name < 0) return { events: [], errors: ["missing date/name columns"] };
  const events: CaliEvent[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((r, i) => {
    const get = (k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
    try {
      let date = get("date");
      const dm = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.exec(date);
      if (dm) date = `${dm[3].length === 2 ? "20" + dm[3] : dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      const time = (get("time") || "00:00").padStart(5, "0");
      const startsAt = parseLocalDateTime(`${date}T${time}`);
      const name = get("name");
      if (!name) throw new Error("name");
      const phone = get("phone");
      const priceRaw = get("price").replace(/[^\d.]/g, "");
      const durRaw = get("duration").replace(/\D/g, "");
      const id = get("id") || `csv:${startsAt.toISOString()}:${phone.replace(/\D/g, "") || name}`;
      events.push({
        type: "appointment.upsert",
        data: {
          id,
          startsAt: startsAt.toISOString(),
          durationMin: durRaw ? Math.min(600, Math.max(5, Number(durRaw))) : null,
          status: get("status") || null,
          price: priceRaw ? Number(priceRaw) : null,
          service: get("service") ? { name: get("service") } : null,
          staffName: get("staff") || null,
          customer: { name, phone: phone || null, email: get("email") || null },
        },
      });
    } catch {
      errors.push(`row ${i + 2}`);
    }
  });
  return { events, errors };
}
