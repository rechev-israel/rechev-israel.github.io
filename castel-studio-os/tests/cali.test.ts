import { describe, expect, it } from "vitest";
import { mapStatus, caliBatchSchema } from "@/server/integrations/cali/sync";
import { signPayload, verifySignature } from "@/server/integrations/cali/signature";
import { csvToCaliEvents } from "@/server/integrations/cali/csv";

describe("Cali status mapping", () => {
  const past = new Date("2020-01-01T10:00:00Z");
  const future = new Date("2099-01-01T10:00:00Z");
  it("maps known statuses in he/en", () => {
    expect(mapStatus("Cancelled", future)).toBe("CANCELLED");
    expect(mapStatus("בוטל", future)).toBe("CANCELLED");
    expect(mapStatus("no-show", past)).toBe("NO_SHOW");
    expect(mapStatus("confirmed", future)).toBe("CONFIRMED");
  });
  it("unknown status falls back by time", () => {
    expect(mapStatus(undefined, past)).toBe("COMPLETED");
    expect(mapStatus("weird", future)).toBe("SCHEDULED");
  });
});

describe("webhook signature", () => {
  const secret = "s".repeat(32);
  const body = '{"events":[]}';
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);
  it("accepts a valid signature", () => {
    expect(verifySignature({ secret, timestamp: ts, signature: signPayload(secret, ts, body), rawBody: body, now }).ok).toBe(true);
  });
  it("rejects tampering, wrong secret, replay and missing config", () => {
    expect(verifySignature({ secret, timestamp: ts, signature: signPayload(secret, ts, body), rawBody: body + " ", now }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: signPayload("x".repeat(32), ts, body), rawBody: body, now }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: String(now / 1000 - 600), signature: signPayload(secret, String(now / 1000 - 600), body), rawBody: body, now })).toEqual({ ok: false, reason: "stale" });
    expect(verifySignature({ secret: undefined, timestamp: ts, signature: "x", rawBody: body, now })).toEqual({ ok: false, reason: "not_configured" });
    expect(verifySignature({ secret: "short", timestamp: ts, signature: "x", rawBody: body, now }).ok).toBe(false);
  });
});

describe("payload validation", () => {
  it("accepts a valid batch and rejects junk", () => {
    expect(caliBatchSchema.safeParse({ events: [{ type: "appointment.cancelled", data: { id: "a1" } }] }).success).toBe(true);
    expect(caliBatchSchema.safeParse({ events: [{ type: "appointment.upsert", data: { id: "a1", startsAt: "not-a-date" } }] }).success).toBe(false);
    expect(caliBatchSchema.safeParse({ events: [{ type: "drop.table", data: {} }] }).success).toBe(false);
    expect(caliBatchSchema.safeParse({ events: [] }).success).toBe(false);
  });
});

describe("CSV → events", () => {
  it("parses Hebrew headers and builds deterministic ids", () => {
    const csv = "תאריך,שעה,שם,טלפון,שירות,מחיר,סטטוס\n17/11/2026,10:30,דני לוי,050-1234567,תספורת,100,הושלם\n";
    const a = csvToCaliEvents(csv);
    const b = csvToCaliEvents(csv);
    expect(a.events).toHaveLength(1);
    expect(a.events[0].type).toBe("appointment.upsert");
    expect(a.events[0].data.id).toBe(b.events[0].data.id);
  });
  it("uses the explicit id column when present", () => {
    const { events } = csvToCaliEvents("id,date,time,name\nA77,2026-11-20,09:00,Avi\n");
    expect(events[0].data.id).toBe("A77");
  });
});
