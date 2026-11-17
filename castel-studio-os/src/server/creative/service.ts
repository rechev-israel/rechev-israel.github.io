import { db } from "@/lib/db";
import { audit } from "@/server/audit";
import { logger } from "@/lib/logger";
import { providerFor, replicatePoll, startGeneration, type CreativeKind } from "./providers";

const PERSIST_LIMIT = 4_000_000;
const ALLOWED = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm)|audio\/(mpeg|wav|mp3)|model\/gltf-binary|application\/octet-stream)$/;

/**
 * Provider result URLs are often temporary. Copy small outputs into the database so they stay available;
 * large outputs keep the URL and are flagged `temporaryUrl` so the UI asks the owner to download them.
 */
export async function persistOutput(url: string): Promise<{ dataUrl?: string; mimeType?: string; temporaryUrl?: boolean }> {
  try {
    if (!/^https:\/\//.test(url)) return { temporaryUrl: true };
    const res = await fetch(url);
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const len = Number(res.headers.get("content-length") ?? "0");
    if (!res.ok || !ALLOWED.test(type) || len > PERSIST_LIMIT) return { mimeType: type || undefined, temporaryUrl: true };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > PERSIST_LIMIT) return { mimeType: type, temporaryUrl: true };
    return { dataUrl: `data:${type};base64,${buf.toString("base64")}`, mimeType: type };
  } catch (e) {
    logger.warn("creative.persist_failed", { err: String(e) });
    return { temporaryUrl: true };
  }
}

async function finish(id: string, outputUrl: string | null | undefined, dataUrl: string | null | undefined, mimeType: string | null | undefined, model?: string) {
  let stored: { dataUrl?: string; mimeType?: string; temporaryUrl?: boolean } = { dataUrl: dataUrl ?? undefined, mimeType: mimeType ?? undefined, temporaryUrl: false };
  if (!dataUrl && outputUrl) stored = { ...(await persistOutput(outputUrl)) };
  const prev = await db.creativeAsset.findUnique({ where: { id }, select: { meta: true } });
  return db.creativeAsset.update({
    where: { id },
    data: {
      status: "succeeded", outputUrl: outputUrl ?? null, dataUrl: stored.dataUrl ?? null, mimeType: stored.mimeType ?? mimeType ?? null, ...(model ? { model } : {}),
      meta: { ...((prev?.meta as object) ?? {}), temporaryUrl: Boolean(stored.temporaryUrl && !stored.dataUrl) },
    },
  });
}

/** Create a generation job. Without a configured provider the job is stored as pending_config (never faked). */
export async function createGenerationJob(actor: { id: string; businessId: string }, input: { kind: CreativeKind; title: string; prompt: string; imageUrl?: string | null; extraInput?: Record<string, unknown>; voiceId?: string; tags?: string[] }) {
  const provider = providerFor(input.kind);
  const asset = await db.creativeAsset.create({
    data: {
      businessId: actor.businessId, kind: input.kind, title: input.title, prompt: input.prompt, provider: provider ?? "none",
      status: provider ? "processing" : "pending_config", createdById: actor.id,
      meta: { imageUrl: input.imageUrl ?? null, extraInput: input.extraInput ?? null, tags: input.tags ?? [] } as object,
    },
  });
  await audit({ businessId: actor.businessId, userId: actor.id, action: "creative.job_create", entityType: "CreativeAsset", entityId: asset.id, metadata: { kind: input.kind, provider } });
  if (!provider) return asset;
  const r = await startGeneration(input.kind, input);
  if (r.state === "done") return finish(asset.id, r.outputUrl, r.dataUrl, r.mimeType, r.model);
  if (r.state === "running") return db.creativeAsset.update({ where: { id: asset.id }, data: { status: "processing", providerJobId: r.jobId, model: r.model } });
  return db.creativeAsset.update({ where: { id: asset.id }, data: { status: "failed", error: r.error.slice(0, 500), model: r.model ?? null } });
}

/** Poll running provider jobs (called from the studio page and the daily cron). */
export async function refreshCreativeJobs(businessId?: string, limit = 20) {
  const running = await db.creativeAsset.findMany({ where: { status: "processing", provider: "replicate", providerJobId: { not: null }, ...(businessId ? { businessId } : {}) }, take: limit });
  for (const a of running) {
    const r = await replicatePoll(a.providerJobId!);
    if (r.state === "done") await finish(a.id, r.outputUrl, null, r.mimeType ?? null);
    else if (r.state === "failed") await db.creativeAsset.update({ where: { id: a.id }, data: { status: "failed", error: r.error.slice(0, 500) } });
  }
  return running.length;
}
