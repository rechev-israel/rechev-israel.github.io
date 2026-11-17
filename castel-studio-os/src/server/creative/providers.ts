/**
 * Creative Studio media providers. Each adapter is "configured" only when its environment variables exist;
 * otherwise jobs are stored as `pending_config` and nothing is simulated.
 *
 *  - OpenAI Images  (OPENAI_API_KEY, optional OPENAI_IMAGE_MODEL)         → image
 *  - Replicate      (REPLICATE_API_TOKEN + REPLICATE_MODEL_<KIND>)         → image, image_edit, video, animation, model3d
 *  - ElevenLabs TTS (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)             → voiceover
 *
 * Replicate model slugs are chosen by the owner (e.g. "owner/model" or "owner/model:version"); input keys
 * differ between models, so we send `prompt` (+ `image` when given) and allow extra JSON input per job.
 */
export type CreativeKind = "image" | "image_edit" | "video" | "animation" | "model3d" | "voiceover";

export type StartResult =
  | { state: "done"; outputUrl?: string; dataUrl?: string; mimeType?: string; model: string }
  | { state: "running"; jobId: string; model: string }
  | { state: "failed"; error: string; model?: string };

export type PollResult = { state: "done"; outputUrl: string; mimeType?: string } | { state: "running" } | { state: "failed"; error: string };

const env = (k: string) => process.env[k]?.trim() || "";
const MAX_INLINE_BYTES = 4_000_000;

export function replicateModelFor(kind: CreativeKind) {
  const key = { image: "REPLICATE_MODEL_IMAGE", image_edit: "REPLICATE_MODEL_IMAGE_EDIT", video: "REPLICATE_MODEL_VIDEO", animation: "REPLICATE_MODEL_ANIMATION", model3d: "REPLICATE_MODEL_3D", voiceover: "" }[kind];
  return key ? env(key) : "";
}

/** Which provider will handle a kind right now (null = pending configuration). */
export function providerFor(kind: CreativeKind): "openai" | "replicate" | "elevenlabs" | null {
  if (kind === "voiceover") return env("ELEVENLABS_API_KEY") && env("ELEVENLABS_VOICE_ID") ? "elevenlabs" : null;
  if (env("REPLICATE_API_TOKEN") && replicateModelFor(kind)) return "replicate";
  if (kind === "image" && env("OPENAI_API_KEY")) return "openai";
  return null;
}

export function requiredEnvFor(kind: CreativeKind) {
  if (kind === "voiceover") return ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
  const rep = ["REPLICATE_API_TOKEN", { image: "REPLICATE_MODEL_IMAGE", image_edit: "REPLICATE_MODEL_IMAGE_EDIT", video: "REPLICATE_MODEL_VIDEO", animation: "REPLICATE_MODEL_ANIMATION", model3d: "REPLICATE_MODEL_3D" }[kind]];
  return kind === "image" ? [...rep, "— or — OPENAI_API_KEY"] : rep;
}

async function openaiImage(prompt: string): Promise<StartResult> {
  const model = env("OPENAI_IMAGE_MODEL") || "gpt-image-1";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } };
  if (!res.ok) return { state: "failed", error: data.error?.message ?? `HTTP ${res.status}`, model };
  const item = data.data?.[0];
  if (item?.b64_json) {
    if (item.b64_json.length * 0.75 > MAX_INLINE_BYTES) return { state: "failed", error: "image too large to store", model };
    return { state: "done", dataUrl: `data:image/png;base64,${item.b64_json}`, mimeType: "image/png", model };
  }
  if (item?.url) return { state: "done", outputUrl: item.url, mimeType: "image/png", model };
  return { state: "failed", error: "empty response", model };
}

function replicateOutputUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return replicateOutputUrl(output[0]);
  if (output && typeof output === "object") {
    for (const k of ["url", "video", "mesh", "model_file", "glb", "output", "image"]) {
      const v = (output as Record<string, unknown>)[k];
      if (typeof v === "string") return v;
    }
  }
  return null;
}

async function replicateStart(kind: CreativeKind, input: Record<string, unknown>): Promise<StartResult> {
  const slug = replicateModelFor(kind);
  const [ref, version] = slug.split(":");
  const url = version ? "https://api.replicate.com/v1/predictions" : `https://api.replicate.com/v1/models/${ref}/predictions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("REPLICATE_API_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify(version ? { version, input } : { input }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; status?: string; output?: unknown; error?: string; detail?: string };
  if (!res.ok || !data.id) return { state: "failed", error: data.detail ?? data.error ?? `HTTP ${res.status}`, model: slug };
  if (data.status === "succeeded") {
    const out = replicateOutputUrl(data.output);
    return out ? { state: "done", outputUrl: out, model: slug } : { state: "failed", error: "no output", model: slug };
  }
  if (data.status === "failed" || data.status === "canceled") return { state: "failed", error: data.error ?? data.status, model: slug };
  return { state: "running", jobId: data.id, model: slug };
}

export async function replicatePoll(jobId: string): Promise<PollResult> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(jobId)}`, { headers: { Authorization: `Bearer ${env("REPLICATE_API_TOKEN")}` } });
  const data = (await res.json().catch(() => ({}))) as { status?: string; output?: unknown; error?: string };
  if (!res.ok) return { state: "failed", error: `HTTP ${res.status}` };
  if (data.status === "succeeded") {
    const out = replicateOutputUrl(data.output);
    return out ? { state: "done", outputUrl: out } : { state: "failed", error: "no output" };
  }
  if (data.status === "failed" || data.status === "canceled") return { state: "failed", error: data.error ?? data.status ?? "failed" };
  return { state: "running" };
}

async function elevenlabsTts(text: string): Promise<StartResult> {
  const model = env("ELEVENLABS_MODEL") || "eleven_multilingual_v2";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env("ELEVENLABS_VOICE_ID"))}`, {
    method: "POST",
    headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model }),
  });
  if (!res.ok) return { state: "failed", error: `HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`, model };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_INLINE_BYTES) return { state: "failed", error: "audio too large to store (shorten the script)", model };
  return { state: "done", dataUrl: `data:audio/mpeg;base64,${buf.toString("base64")}`, mimeType: "audio/mpeg", model };
}

export async function startGeneration(kind: CreativeKind, opts: { prompt: string; imageUrl?: string | null; extraInput?: Record<string, unknown> }): Promise<StartResult> {
  const provider = providerFor(kind);
  try {
    if (provider === "elevenlabs") return await elevenlabsTts(opts.prompt);
    if (provider === "openai") return await openaiImage(opts.prompt);
    if (provider === "replicate") return await replicateStart(kind, { prompt: opts.prompt, ...(opts.imageUrl ? { image: opts.imageUrl } : {}), ...(opts.extraInput ?? {}) });
    return { state: "failed", error: "provider_not_configured" };
  } catch (e) {
    return { state: "failed", error: `network: ${String(e).slice(0, 200)}` };
  }
}
