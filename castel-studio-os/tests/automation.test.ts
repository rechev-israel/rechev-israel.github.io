import { describe, expect, it } from "vitest";
import { definitionSchema, evaluateConditions, retryDelayMs } from "@/server/automation/definition";
import { BUILTIN_AUTOMATIONS } from "@/server/automation/defaults";
import { contactDecision } from "@/server/comms/messages";
import { DEFAULT_TEMPLATES, renderTemplate } from "@/server/comms/templates";

describe("automation conditions", () => {
  const ctx = { customer: { status: "VIP", visitCount: 12, tags: ["fade", "vip"], phone: "+972501234567", email: null }, lead: { kind: "academy" } };
  it("evaluates operators", () => {
    expect(evaluateConditions([{ field: "customer.status", op: "eq", value: "VIP" }], ctx).pass).toBe(true);
    expect(evaluateConditions([{ field: "customer.visitCount", op: "gte", value: 10 }], ctx).pass).toBe(true);
    expect(evaluateConditions([{ field: "customer.visitCount", op: "lt", value: 10 }], ctx).pass).toBe(false);
    expect(evaluateConditions([{ field: "customer.tags", op: "contains", value: "fade" }], ctx).pass).toBe(true);
    expect(evaluateConditions([{ field: "customer.email", op: "exists" }], ctx).pass).toBe(false);
    expect(evaluateConditions([{ field: "customer.email", op: "not_exists" }], ctx).pass).toBe(true);
    expect(evaluateConditions([{ field: "lead.kind", op: "in", value: ["academy", "barbershop"] }], ctx).pass).toBe(true);
    expect(evaluateConditions([{ field: "missing.path", op: "eq", value: "x" }], ctx).pass).toBe(false);
  });
  it("all conditions must pass and reports the failing one", () => {
    const r = evaluateConditions([{ field: "customer.status", op: "eq", value: "VIP" }, { field: "lead.kind", op: "eq", value: "barbershop" }], ctx);
    expect(r.pass).toBe(false);
    expect(r.failed?.field).toBe("lead.kind");
  });
  it("backs off exponentially with a cap", () => {
    expect(retryDelayMs(1)).toBe(5 * 60_000);
    expect(retryDelayMs(2)).toBe(10 * 60_000);
    expect(retryDelayMs(20)).toBe(6 * 3600_000);
  });
  it("all built-in workflows are valid", () => {
    expect(BUILTIN_AUTOMATIONS.length).toBeGreaterThanOrEqual(7);
    for (const b of BUILTIN_AUTOMATIONS) expect(definitionSchema.safeParse(b.definition).success, b.key).toBe(true);
    const keys = BUILTIN_AUTOMATIONS.map((b) => b.key);
    for (const k of ["new_customer", "appointment_reminder", "post_visit", "academy_lead", "birthday", "weekly_report", "campaign_approval"]) expect(keys).toContain(k);
  });
  it("rejects malformed definitions", () => {
    expect(definitionSchema.safeParse({ actions: [] }).success).toBe(false);
    expect(definitionSchema.safeParse({ actions: [{ type: "shell.exec", cmd: "rm" }] }).success).toBe(false);
    expect(definitionSchema.safeParse({ conditions: [{ field: "a;drop", op: "eq", value: 1 }], actions: [{ type: "report.weekly" }] }).success).toBe(false);
  });
});

describe("communication rules", () => {
  const base = { phone: "+972501234567", email: "a@b.co", status: "ACTIVE", marketingConsentSms: "UNKNOWN", marketingConsentEmail: "UNKNOWN", marketingConsentWhatsapp: "UNKNOWN" };
  it("transactional messages allowed unless opted out/blocked", () => {
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", customer: base })).toEqual({ ok: true, to: "+972501234567" });
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", customer: { ...base, marketingConsentWhatsapp: "OPTED_OUT" } }).ok).toBe(false);
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", customer: { ...base, status: "BLOCKED" } }).ok).toBe(false);
  });
  it("marketing requires explicit opt-in", () => {
    expect(contactDecision({ channel: "WHATSAPP", purpose: "marketing", customer: base })).toEqual({ ok: false, reason: "no_marketing_consent" });
    expect(contactDecision({ channel: "WHATSAPP", purpose: "marketing", customer: { ...base, marketingConsentWhatsapp: "OPTED_IN" } }).ok).toBe(true);
  });
  it("needs a contact address for the channel", () => {
    expect(contactDecision({ channel: "EMAIL", purpose: "transactional", customer: { ...base, email: null } })).toEqual({ ok: false, reason: "no_contact" });
  });
  it("leads need consent and never get marketing", () => {
    const lead = { phone: "+972541112222", email: null, consent: true, status: "NEW" };
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", lead }).ok).toBe(true);
    expect(contactDecision({ channel: "WHATSAPP", purpose: "transactional", lead: { ...lead, consent: false } }).ok).toBe(false);
    expect(contactDecision({ channel: "WHATSAPP", purpose: "marketing", lead }).ok).toBe(false);
  });
  it("renders templates and tidies missing vars", () => {
    expect(renderTemplate("היי {{name}}, תור ב-{{time}} ({{service}})", { name: "דני", time: "10:30" })).toBe("היי דני, תור ב-10:30");
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.body.he).toBeTruthy();
      expect(t.body.en).toBeTruthy();
    }
    expect(DEFAULT_TEMPLATES.find((t) => t.key === "birthday")?.purpose).toBe("marketing");
  });
});

describe("WhatsApp kill switch", () => {
  it("credentials alone never enable sending", async () => {
    const { PROVIDERS } = await import("@/server/comms/providers");
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = "x"; process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
    delete process.env.WHATSAPP_SENDING_ENABLED;
    expect(PROVIDERS.WHATSAPP.configured()).toBe(false);
    process.env.WHATSAPP_SENDING_ENABLED = "true";
    expect(PROVIDERS.WHATSAPP.configured()).toBe(true);
    delete process.env.WHATSAPP_SENDING_ENABLED; delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN; delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });
});
