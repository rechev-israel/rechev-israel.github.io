import type { PrismaClient } from "@prisma/client";
import { COURSE_DEFINITIONS } from "@/domain/academy";
import { ensureBuiltinAutomations } from "@/server/automation/defaults";

/**
 * Idempotent base data: business, first branch, academy courses, placeholder opening hours.
 * Safe to run repeatedly — never deletes or overwrites user-entered records (except refreshing course definitions).
 */
export async function ensureBaseData(db: PrismaClient) {
  let business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) {
    business = await db.business.create({
      data: {
        name: "CASTEL STUDIO",
        category: "Premium men's barbershop & barber education academy",
        city: "Ashkelon",
        country: "IL",
        currency: "ILS",
        timezone: "Asia/Jerusalem",
        locale: "he",
        instagram: "https://www.instagram.com/castel.cutzz",
        branches: { create: { name: "CASTEL STUDIO — אשקלון" } },
      },
    });
  }
  for (const c of COURSE_DEFINITIONS) {
    await db.course.upsert({
      where: { businessId_code: { businessId: business.id, code: c.code } },
      create: { businessId: business.id, ...c },
      update: { ...c },
    });
  }
  const branch = await db.branch.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: "asc" } });
  if (branch && (await db.availabilityRule.count({ where: { branchId: branch.id } })) === 0) {
    const hours = [0, 1, 2, 3].map((weekday) => ({ weekday, startTime: "09:00", endTime: "20:00" }));
    hours.push({ weekday: 4, startTime: "09:00", endTime: "21:00" }, { weekday: 5, startTime: "08:00", endTime: "14:00" });
    await db.availabilityRule.createMany({ data: hours.map((h) => ({ ...h, branchId: branch.id })) });
  }
  await ensureBuiltinAutomations(db, business.id);
  return business;
}
