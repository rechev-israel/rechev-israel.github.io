/**
 * Build entrypoint used by Vercel (see vercel.json → buildCommand).
 *  1. prisma generate
 *  2. prisma migrate deploy  — applies pending migrations only. Never resets, never drops data.
 *     Uses the DIRECT (non-pooled) connection when available, as Prisma migrations require.
 *  3. next build
 * Secrets are never printed.
 */
import { execSync } from "node:child_process";

const env = { ...process.env };
// Neon/Vercel name the variables differently depending on the "custom prefix" chosen at connect time.
const first = (...keys) => keys.map((k) => env[k]).find((v) => v && v.trim());
const pooled = first("DATABASE_URL", "DATABASE_POSTGRES_PRISMA_URL", "DATABASE_POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "STORAGE_URL");
const direct =
  first("DATABASE_URL_UNPOOLED", "DATABASE_POSTGRES_URL_NON_POOLING", "POSTGRES_URL_NON_POOLING", "STORAGE_URL_UNPOOLED", "DIRECT_DATABASE_URL") || pooled;
console.log(`Database: pooled=${pooled ? "found" : "missing"}, direct=${direct && direct !== pooled ? "found" : "same as pooled"}`);

if (!pooled) {
  console.error(
    "\n✖ No database configured.\n" +
      "  In Vercel: Project → Storage → Create Database → Neon (Postgres) → connect it to this project,\n" +
      "  then redeploy. (It sets DATABASE_URL and DATABASE_URL_UNPOOLED automatically.)\n",
  );
  process.exit(1);
}
env.DATABASE_URL = pooled;

const run = (cmd, extraEnv = {}) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...env, ...extraEnv } });
};

run("npx prisma generate");
run("npx prisma migrate deploy", { DATABASE_URL: direct });
run("npx next build");
