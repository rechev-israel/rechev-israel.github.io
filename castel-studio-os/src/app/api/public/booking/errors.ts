import { BookingError } from "@/server/services/online-booking";
import { logger } from "@/lib/logger";

const STATUS: Record<BookingError["code"], number> = { disabled: 503, service: 404, staff: 404, date: 422, slot_taken: 409, phone: 422, limit: 429, blocked: 403, not_found: 404, too_late: 409, busy: 503 };

export function bookingErrorResponse(e: unknown) {
  if (e instanceof BookingError) return Response.json({ error: e.code }, { status: STATUS[e.code] });
  logger.error("booking.failed", { err: String(e) });
  return Response.json({ error: "server" }, { status: 500 });
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
