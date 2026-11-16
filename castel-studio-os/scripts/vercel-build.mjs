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
const pooled = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
const direct = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DIRECT_DATABASE_URL || pooled;

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
