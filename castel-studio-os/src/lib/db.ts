import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Vercel/Neon may expose the pooled URL under different names.
    datasourceUrl:
      process.env.DATABASE_URL ||
      process.env.DATABASE_POSTGRES_PRISMA_URL ||
      process.env.DATABASE_POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.STORAGE_URL,
    log: process.env.NODE_ENV === "test" ? [] : process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
