/**
 * Adapter for the existing CASTEL booking app (https://cali-b5f0e.web.app).
 * No public API is assumed. The only supported channel is a CSV file the owner exports manually.
 * If the vendor later provides an official API or webhook, implement `ExternalBookingSource` against it.
 */
import type { AppointmentStatus } from "@prisma/client";
import { parseLocalDateTime } from "@/lib/dates";

export interface ExternalBookingSource {
  id: string;
  kind: "csv" | "api";
}

export type ParsedBookingRow = { startsAt: Date; name: string; phone?: string; service?: string; price?: number; status: AppointmentStatus };

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const STATUS_MAP: Record<string, AppointmentStatus> = {
  completed: "COMPLETED", done: "COMPLETED", הושלם: "COMPLETED",
  cancelled: "CANCELLED", canceled: "CANCELLED", בוטל: "CANCELLED",
  "no-show": "NO_SHOW", noshow: "NO_SHOW", "לא הגיע": "NO_SHOW",
  confirmed: "CONFIRMED", אושר: "CONFIRMED",
};

export function parseBookingCsv(text: string): { rows: ParsedBookingRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ["empty"] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  if (idx("date") < 0 || idx("name") < 0) return { rows: [], errors: ["missing date/name columns"] };
  const rows: ParsedBookingRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((r, i) => {
    const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? "").trim() : "");
    try {
      let date = get("date");
      const dm = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(date); // DD/MM/YYYY (Israeli format)
      if (dm) date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      const time = get("time") || "00:00";
      const startsAt = parseLocalDateTime(`${date}T${time.padStart(5, "0")}`);
      const name = get("name");
      if (!name) throw new Error("name");
      const priceRaw = get("price").replace(/[^\d.]/g, "");
      rows.push({
        startsAt, name,
        phone: get("phone") || undefined,
        service: get("service") || undefined,
        price: priceRaw ? Number(priceRaw) : undefined,
        status: STATUS_MAP[get("status").toLowerCase()] ?? (startsAt < new Date() ? "COMPLETED" : "SCHEDULED"),
      });
    } catch {
      errors.push(`row ${i + 2}`);
    }
  });
  return { rows, errors };
}
