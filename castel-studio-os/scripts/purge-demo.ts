/* Removes every record created by the DEMO seed. */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const tx = await db.transaction.deleteMany({ where: { description: { startsWith: "[DEMO]" } } });
  const ap = await db.appointment.deleteMany({ where: { notes: "[DEMO]" } });
  const cu = await db.customer.deleteMany({ where: { tags: { has: "DEMO" } } });
  const sv = await db.service.deleteMany({ where: { nameEn: { startsWith: "[DEMO]" } } });
  const ld = await db.lead.deleteMany({ where: { name: { startsWith: "[DEMO]" } } });
  console.log({ transactions: tx.count, appointments: ap.count, customers: cu.count, services: sv.count, leads: ld.count });
}
main().finally(() => db.$disconnect());
