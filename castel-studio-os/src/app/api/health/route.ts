import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + build id (used by the app to auto-update) + database round-trip time (for performance checks). */
export async function GET() {
  try {
    const t: number[] = [];
    for (let i = 0; i < 3; i++) { const s = performance.now(); await db.$queryRaw`SELECT 1`; t.push(Math.round(performance.now() - s)); }
    return Response.json(
      { ok: true, db: "up", build: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 12), region: process.env.VERCEL_REGION ?? null, dbRoundTripMs: t },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
