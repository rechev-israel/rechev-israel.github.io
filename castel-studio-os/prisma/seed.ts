/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { COURSE_DEFINITIONS } from "../src/domain/academy";

const db = new PrismaClient();

async function main() {
  let business = await db.business.findFirst();
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
    console.log("✔ Business created");
  }

  const email = (process.env.SEED_OWNER_EMAIL || "owner@castel.studio").toLowerCase();
  if (!(await db.user.findUnique({ where: { email } }))) {
    let password = process.env.SEED_OWNER_PASSWORD?.trim();
    let generated = false;
    if (!password) {
      password = randomBytes(12).toString("base64url") + "9";
      generated = true;
    }
    await db.user.create({
      data: { businessId: business.id, email, name: process.env.SEED_OWNER_NAME || "Castel Owner", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`✔ Owner user created: ${email}`);
    if (generated) console.log(`  Generated password (shown once — change it after first login): ${password}`);
  }

  for (const c of COURSE_DEFINITIONS) {
    await db.course.upsert({
      where: { businessId_code: { businessId: business.id, code: c.code } },
      create: { businessId: business.id, ...c },
      update: { ...c },
    });
  }
  console.log("✔ Academy courses (Group 5,500 ₪ / VIP 6,500 ₪) upserted");

  const branch = await db.branch.findFirst({ where: { businessId: business.id } });
  if (branch && (await db.availabilityRule.count({ where: { branchId: branch.id } })) === 0) {
    // Default opening hours — editable placeholder; owner should confirm actual hours.
    const hours = [
      { weekday: 0, startTime: "09:00", endTime: "20:00" },
      { weekday: 1, startTime: "09:00", endTime: "20:00" },
      { weekday: 2, startTime: "09:00", endTime: "20:00" },
      { weekday: 3, startTime: "09:00", endTime: "20:00" },
      { weekday: 4, startTime: "09:00", endTime: "21:00" },
      { weekday: 5, startTime: "08:00", endTime: "14:00" },
    ];
    await db.availabilityRule.createMany({ data: hours.map((h) => ({ ...h, branchId: branch.id })) });
    console.log("✔ Default opening hours (placeholder — confirm in Bookings)");
  }

  if (process.env.SEED_DEMO_DATA === "true") await seedDemo(business.id);
}

/** Clearly-labelled demo data. Every record is tagged DEMO / prefixed [DEMO] and can be purged. */
async function seedDemo(businessId: string) {
  if (await db.customer.count({ where: { businessId, tags: { has: "DEMO" } } })) {
    console.log("• Demo data already present — skipping");
    return;
  }
  const svc = await db.service.create({ data: { businessId, nameHe: "[DEMO] תספורת גבר", nameEn: "[DEMO] Men's haircut", durationMin: 45, price: 100 } });
  const svc2 = await db.service.create({ data: { businessId, nameHe: "[DEMO] תספורת + זקן", nameEn: "[DEMO] Haircut + beard", durationMin: 60, price: 140 } });
  const names = ["דניאל", "איתי", "נועם", "אורי", "יוסי", "עומר", "רון", "אלון", "תומר", "גיל"];
  const now = Date.now();
  for (let i = 0; i < names.length; i++) {
    const c = await db.customer.create({
      data: {
        businessId, firstName: names[i], lastName: "[DEMO]", phone: `+97250000${String(1000 + i)}`, tags: ["DEMO"], source: "demo",
        birthday: new Date(Date.UTC(1995, new Date().getUTCMonth(), ((i * 3) % 27) + 1)),
        marketingConsentWhatsapp: i % 2 ? "OPTED_IN" : "UNKNOWN",
      },
    });
    const visits = (i % 4) + 1;
    for (let v = 0; v < visits; v++) {
      const startsAt = new Date(now - (v * 25 + i * 9 + 3) * 86400_000);
      const s = v % 2 ? svc2 : svc;
      const a = await db.appointment.create({
        data: { businessId, customerId: c.id, serviceId: s.id, startsAt, endsAt: new Date(startsAt.getTime() + s.durationMin * 60000), status: "COMPLETED", price: s.price, notes: "[DEMO]" },
      });
      await db.transaction.create({ data: { businessId, type: "INCOME", kind: "ACTUAL", category: "services", amount: s.price, occurredAt: startsAt, description: `[DEMO] appointment:${a.id}`, customerId: c.id } });
    }
    const future = new Date(now + (i + 1) * 3600_000 * 7);
    await db.appointment.create({ data: { businessId, customerId: c.id, serviceId: svc.id, startsAt: future, endsAt: new Date(future.getTime() + 45 * 60000), price: svc.price, notes: "[DEMO]" } });
  }
  for (let m = 0; m < 5; m++) {
    const d = new Date(now - m * 30 * 86400_000);
    await db.transaction.create({ data: { businessId, type: "EXPENSE", kind: "ACTUAL", category: "rent", amount: 900, occurredAt: d, description: "[DEMO] rent" } });
    await db.transaction.create({ data: { businessId, type: "EXPENSE", kind: "ACTUAL", category: "supplies", amount: 180, occurredAt: d, description: "[DEMO] supplies" } });
  }
  await db.lead.create({ data: { businessId, name: "[DEMO] ליד לדוגמה", phone: "+972500009999", source: "demo", status: "NEW", consent: true } });
  console.log("✔ DEMO data seeded (tagged DEMO). Remove with: npm run db:purge-demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
