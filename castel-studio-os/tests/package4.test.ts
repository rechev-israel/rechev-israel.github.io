import { describe, expect, it } from "vitest";
import { blockSchema, blocksSchema, defaultBlocks, pageMetaSchema, safeHref } from "@/server/sites/blocks";
import { twinAllows, twinSystemPrompt } from "@/server/ai/twin";

describe("site blocks", () => {
  it("default pages are valid in he & en", () => {
    expect(blocksSchema.safeParse(defaultBlocks(true)).success).toBe(true);
    expect(blocksSchema.safeParse(defaultBlocks(false)).success).toBe(true);
  });
  it("links: allows safe schemes only", () => {
    for (const ok of ["", "/join", "https://wa.me/972501234567", "tel:+972-50-1234567", "mailto:a@b.co"]) expect(safeHref.safeParse(ok).success, ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "http://x.com", "data:text/html,<script>", "//evil.com", "https://x.com/\"onmouseover=alert(1)"]) expect(safeHref.safeParse(bad).success, bad).toBe(false);
  });
  it("rejects unknown block types and oversized content", () => {
    expect(blockSchema.safeParse({ type: "script", src: "x" }).success).toBe(false);
    expect(blockSchema.safeParse({ type: "text", title: "a", body: "x".repeat(5000) }).success).toBe(false);
    expect(blockSchema.safeParse({ type: "gallery", title: "g", assetIds: ["../../etc"] }).success).toBe(false);
  });
  it("slugs are url-safe", () => {
    expect(pageMetaSchema.safeParse({ title: "Home", slug: "home-page" }).success).toBe(true);
    expect(pageMetaSchema.safeParse({ title: "Home", slug: "Home Page" }).success).toBe(false);
    expect(pageMetaSchema.safeParse({ title: "Home", slug: "../admin" }).success).toBe(false);
  });
});

describe("digital twin consent", () => {
  const p = { consentGiven: true, revokedAt: null, consentScopes: ["chat"] };
  it("requires active consent per scope", () => {
    expect(twinAllows(null, "chat")).toBe(false);
    expect(twinAllows(p, "chat")).toBe(true);
    expect(twinAllows(p, "voice")).toBe(false);
    expect(twinAllows({ ...p, revokedAt: new Date() }, "chat")).toBe(false);
    expect(twinAllows({ ...p, consentGiven: false }, "chat")).toBe(false);
  });
  it("system prompt is grounded in approved knowledge and transparent about AI", () => {
    const s = twinSystemPrompt("Ilai", "warm", [{ title: "Price", body: "Group course 5,500 ILS" }], "he");
    expect(s).toContain("Group course 5,500 ILS");
    expect(s).toMatch(/AI assistant/);
    expect(s).toMatch(/ONLY from the approved knowledge/);
    expect(twinSystemPrompt("Ilai", null, [], "en")).toContain("(none yet)");
  });
});
