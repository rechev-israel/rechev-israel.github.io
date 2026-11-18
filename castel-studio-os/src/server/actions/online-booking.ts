"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { getI18n } from "@/i18n";
import { hhmm } from "@/domain/booking";
import { parseLocalDateTime } from "@/lib/dates";
import { formToObject, type ActionState } from "@/lib/validation";
import { runAction } from "./util";

const PERM = "services.edit" as const;
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const done = () => { revalidatePath("/bookings/online"); revalidatePath("/book"); };

export async function saveBookingSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (): Promise<ActionState | void> => {
    const user = await requireUser(PERM);
    const d = z.object({
      enabled: bool, autoConfirm: bool, slotStepMin: int(5, 120), minNoticeMin: int(0, 10080), maxDaysAhead: int(1, 180),
      cancelNoticeMin: int(0, 10080), bufferMin: int(0, 120), maxActivePerPhone: int(1, 10),
      noteHe: z.string().trim().max(500).optional(), noteEn: z.string().trim().max(500).optional(),
    }).parse({ ...formToObject(fd), enabled: fd.get("enabled"), autoConfirm: fd.get("autoConfirm") });
    const shopPhone = String(fd.get("shopPhone") ?? "").trim();
    if (shopPhone && !/^[\d+\-\s()]{9,20}$/.test(shopPhone)) return { error: "טלפון לא תקין / invalid phone", fieldErrors: { shopPhone: "✕" } };
    await db.branch.updateMany({ where: { businessId: user.businessId, isActive: true }, data: { phone: shopPhone || null } });
    await db.bookingSettings.upsert({ where: { businessId: user.businessId }, create: { businessId: user.businessId, ...d }, update: d });
    // Opening bookings with no bookable barber would show an empty page: make the person enabling it bookable.
    if (d.enabled && !(await db.user.count({ where: { businessId: user.businessId, isActive: true, acceptsBookings: true } })))
      await db.user.update({ where: { id: user.id }, data: { acceptsBookings: true } });
    await audit({ businessId: user.businessId, userId: user.id, action: "booking.settings", entityType: "BookingSettings", metadata: { enabled: d.enabled } });
    done();
  });
}

/** Replace a weekly schedule (shop hours when staffId is empty; a barber's own hours otherwise). One window per day. */
export async function saveHoursAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser(PERM);
    const { locale } = await getI18n();
    const staffId = String(fd.get("staffId") ?? "") || null;
    const branch = await db.branch.findFirst({ where: { businessId: user.businessId, isActive: true }, orderBy: { createdAt: "asc" } });
    if (!branch) return { error: "no branch" };
    if (staffId && !(await db.user.findFirst({ where: { id: staffId, businessId: user.businessId } }))) return { error: "bad staff" };
    if (staffId && fd.get("useShop") === "on") {
      await db.availabilityRule.deleteMany({ where: { branchId: branch.id, staffId } });
      done(); return;
    }
    const rows: { weekday: number; startTime: string; endTime: string }[] = [];
    for (let w = 0; w < 7; w++) {
      if (fd.get(`open_${w}`) !== "on") continue;
      const s = String(fd.get(`start_${w}`) ?? ""), e = String(fd.get(`end_${w}`) ?? "");
      const a = hhmm(s), b = hhmm(e);
      if (a == null || b == null || b <= a) return { error: locale === "he" ? "שעת סיום חייבת להיות אחרי שעת פתיחה" : "End time must be after start time", fieldErrors: { [`start_${w}`]: "✕" } };
      rows.push({ weekday: w, startTime: s, endTime: e });
    }
    await db.$transaction([
      db.availabilityRule.deleteMany({ where: { branchId: branch.id, staffId } }),
      db.availabilityRule.createMany({ data: rows.map((r) => ({ ...r, branchId: branch.id, staffId })) }),
    ]);
    await audit({ businessId: user.businessId, userId: user.id, action: "booking.hours", entityType: "AvailabilityRule", entityId: staffId ?? "shop" });
    done();
  });
}

export async function setStaffBookableAction(fd: FormData) {
  const user = await requireUser(PERM);
  const id = String(fd.get("id") ?? "");
  await db.user.updateMany({ where: { id, businessId: user.businessId }, data: { acceptsBookings: fd.get("on") === "1" } });
  done();
}

export async function setServiceOnlineAction(fd: FormData) {
  const user = await requireUser(PERM);
  await db.service.updateMany({ where: { id: String(fd.get("id") ?? ""), businessId: user.businessId }, data: { bookableOnline: fd.get("on") === "1" } });
  done();
}

export async function addTimeOffAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser(PERM);
    const { locale } = await getI18n();
    const d = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), staffId: z.string().optional(), reason: z.string().trim().max(120).optional() }).parse(formToObject(fd));
    const startsAt = parseLocalDateTime(d.from), endsAt = parseLocalDateTime(d.to);
    if (endsAt <= startsAt) return { error: locale === "he" ? "הסיום חייב להיות אחרי ההתחלה" : "End must be after start", fieldErrors: { to: "✕" } };
    if (d.staffId && !(await db.user.findFirst({ where: { id: d.staffId, businessId: user.businessId } }))) return { error: "bad staff" };
    await db.timeOff.create({ data: { businessId: user.businessId, staffId: d.staffId || null, startsAt, endsAt, reason: d.reason || null } });
    const clashes = await db.appointment.count({ where: { businessId: user.businessId, status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, ...(d.staffId ? { staffId: d.staffId } : {}) } });
    done();
    if (clashes) return { ok: true, message: locale === "he" ? `נשמר. שימו לב: ${clashes} תורים קיימים בטווח הזה — יש לטפל בהם ידנית.` : `Saved. Note: ${clashes} existing bookings fall in this range — handle them manually.` };
  });
}

export async function removeTimeOffAction(fd: FormData) {
  const user = await requireUser(PERM);
  await db.timeOff.deleteMany({ where: { id: String(fd.get("id") ?? ""), businessId: user.businessId } });
  done();
}
