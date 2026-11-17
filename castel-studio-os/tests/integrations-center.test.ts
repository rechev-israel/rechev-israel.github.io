import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upserts: unknown[] = [];
vi.mock("@/lib/db", () => ({
  db: {
    integration: { upsert: vi.fn(async (x: unknown) => { upserts.push(x); return x; }), findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    integrationSecret: { findMany: vi.fn(async () => []), upsert: vi.fn(), deleteMany: vi.fn() },
    syncLog: { findFirst: vi.fn(async () => null) },
    business: { findMany: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => [1]),
  },
}));

import { decrypt, encrypt, fingerprint } from "@/server/secrets/crypto";
import { redact, secret } from "@/server/secrets/store";
import { credentialFingerprint, displayState, getDef, runVerification } from "@/server/integrations/registry";

const KEY = "sk-ant-api03-TESTKEY-abcdefghijklmnopqrstuvwxyz0123456789";
beforeEach(() => { upserts.length = 0; process.env.SECRETS_ENCRYPTION_KEY = "x".repeat(48); process.env.ANTHROPIC_API_KEY = KEY; delete process.env.ANTHROPIC_MODEL; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.ANTHROPIC_API_KEY; });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("secret encryption", () => {
  it("round-trips with AES-256-GCM and detects tampering", () => {
    const e = encrypt("hello-secret");
    expect(e.ciphertext).not.toContain("hello");
    expect(decrypt(e)).toBe("hello-secret");
    const bad = { ...e, ciphertext: Buffer.from("tampered").toString("base64") };
    expect(() => decrypt(bad)).toThrow();
  });
  it("refuses a short encryption key", () => {
    process.env.SECRETS_ENCRYPTION_KEY = "short";
    expect(() => encrypt("x")).toThrow(/SECRETS_ENCRYPTION_KEY/);
  });
  it("env vars take priority", () => { expect(secret("ANTHROPIC_API_KEY")).toBe(KEY); });
  it("redacts configured keys and known token shapes from messages", () => {
    const r = redact(`bad key ${KEY} and sk-proj-ABCDEFGHIJKLMNOP and smtps://me:hunter2pass@smtp.x.com`);
    expect(r).not.toContain(KEY);
    expect(r).not.toContain("ABCDEFGHIJKLMNOP");
    expect(r).not.toContain("hunter2pass");
  });
});

describe("display state never claims Connected without a matching successful check", () => {
  const fp = fingerprint(["a"]);
  it("missing credentials → not_configured", () => expect(displayState(["X"], fp, null)).toBe("not_configured"));
  it("no check yet → unverified", () => expect(displayState([], fp, null)).toBe("unverified"));
  it("successful check for current credentials → connected", () => expect(displayState([], fp, { status: "CONNECTED", lastCheckAt: new Date(), lastError: null, config: { fp } })).toBe("connected"));
  it("credentials changed since the check → unverified", () => expect(displayState([], fp, { status: "CONNECTED", lastCheckAt: new Date(), lastError: null, config: { fp: "old" } })).toBe("unverified"));
  it("failed check → error", () => expect(displayState([], fp, { status: "ERROR", lastCheckAt: new Date(), lastError: "x", config: { fp } })).toBe("error"));
  it("fingerprint changes with the key", () => {
    const def = getDef("anthropic")!;
    const a = credentialFingerprint(def);
    process.env.ANTHROPIC_API_KEY = KEY + "z";
    expect(credentialFingerprint(def)).not.toBe(a);
  });
});

describe("Anthropic connection test", () => {
  it("connected only when the key and model verify", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push(url);
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
      return url.includes("/v1/models/") ? json(200, { id: "claude-opus-5-5", display_name: "Claude Opus 5.5" }) : json(200, { data: [{ id: "claude-opus-5-5" }] });
    }));
    const r = await runVerification("b1", "anthropic");
    expect(r.status).toBe("CONNECTED");
    expect(r.info?.model).toBe("Claude Opus 5.5");
    expect(calls.every((u) => u.startsWith("https://api.anthropic.com/v1/models"))).toBe(true); // free endpoints only
    expect(JSON.stringify(upserts)).not.toContain(KEY);
  });
  it("invalid key → ERROR with a clear message, key never persisted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { error: { type: "authentication_error", message: `invalid x-api-key ${KEY}` } })));
    const r = await runVerification("b1", "anthropic");
    expect(r.status).toBe("ERROR");
    expect(r.message.he).toContain("401");
    expect(JSON.stringify(upserts)).not.toContain(KEY);
  });
  it("valid key but unavailable model → ERROR naming available models", async () => {
    process.env.ANTHROPIC_MODEL = "claude-nope";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/v1/models/") ? json(404, { error: { message: "not found" } }) : json(200, { data: [{ id: "claude-sonnet-5-5" }] }))));
    const r = await runVerification("b1", "anthropic");
    expect(r.status).toBe("ERROR");
    expect(r.message.en).toContain("claude-sonnet-5-5");
  });
  it("no key → NOT_CONFIGURED without any network call", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const r = await runVerification("b1", "anthropic");
    expect(r.status).toBe("NOT_CONFIGURED");
    expect(f).not.toHaveBeenCalled();
  });
  it("network failure → ERROR, not connected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("The operation was aborted due to timeout"); }));
    const r = await runVerification("b1", "anthropic");
    expect(r.status).toBe("ERROR");
  });
});

describe("other providers", () => {
  it("WhatsApp test reads number details only and reports the kill switch", async () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = "EAAtesttokenvalue123456"; process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const f = vi.fn(async (_url: string, init?: RequestInit) => { expect(init?.method ?? "GET").toBe("GET"); return json(200, { display_phone_number: "+972 50", verified_name: "Castel" }); });
    vi.stubGlobal("fetch", f);
    const r = await runVerification("b1", "whatsapp");
    expect(r.status).toBe("CONNECTED");
    expect(r.info?.sending).toContain("off");
    expect(String(f.mock.calls[0][0])).not.toContain("/messages");
    delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });
  it("Cali stays waiting until a real signed event arrives", async () => {
    process.env.CALI_WEBHOOK_SECRET = "s".repeat(40);
    const r = await runVerification("b1", "cali");
    expect(r.status).toBe("REQUIRES_AUTHORIZATION");
    delete process.env.CALI_WEBHOOK_SECRET;
  });
  it("Vercel Cron waits for its first recorded run", async () => {
    process.env.CRON_SECRET = "c".repeat(40);
    const r = await runVerification("b1", "vercel-cron");
    expect(r.status).toBe("REQUIRES_AUTHORIZATION");
    delete process.env.CRON_SECRET;
  });
});
