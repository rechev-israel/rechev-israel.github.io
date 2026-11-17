import { afterEach, describe, expect, it } from "vitest";
import { providerFor, requiredEnvFor, replicateModelFor } from "@/server/creative/providers";
import { persistOutput } from "@/server/creative/service";

const KEYS = ["OPENAI_API_KEY", "REPLICATE_API_TOKEN", "REPLICATE_MODEL_IMAGE", "REPLICATE_MODEL_VIDEO", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"];
afterEach(() => { for (const k of KEYS) delete process.env[k]; });

describe("creative provider selection", () => {
  it("nothing configured → every kind pending", () => {
    for (const k of ["image", "image_edit", "video", "animation", "model3d", "voiceover"] as const) expect(providerFor(k)).toBeNull();
  });
  it("OpenAI covers images only; Replicate needs a model per kind", () => {
    process.env.OPENAI_API_KEY = "k";
    expect(providerFor("image")).toBe("openai");
    expect(providerFor("video")).toBeNull();
    process.env.REPLICATE_API_TOKEN = "r";
    expect(providerFor("video")).toBeNull();
    process.env.REPLICATE_MODEL_VIDEO = "owner/video-model";
    expect(providerFor("video")).toBe("replicate");
    expect(replicateModelFor("video")).toBe("owner/video-model");
    process.env.REPLICATE_MODEL_IMAGE = "owner/img";
    expect(providerFor("image")).toBe("replicate");
  });
  it("voice-over needs key + voice id", () => {
    process.env.ELEVENLABS_API_KEY = "e";
    expect(providerFor("voiceover")).toBeNull();
    process.env.ELEVENLABS_VOICE_ID = "v";
    expect(providerFor("voiceover")).toBe("elevenlabs");
    expect(requiredEnvFor("voiceover")).toEqual(["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]);
  });
  it("never persists non-https outputs", async () => {
    expect(await persistOutput("http://example.com/x.png")).toEqual({ temporaryUrl: true });
    expect(await persistOutput("file:///etc/passwd")).toEqual({ temporaryUrl: true });
  });
});
