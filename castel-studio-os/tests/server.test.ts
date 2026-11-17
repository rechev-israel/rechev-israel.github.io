import { describe, expect, it } from "vitest";
import { routeRequest } from "@/server/ai/router";
import { can } from "@/server/auth/rbac";
import { canTransition } from "@/server/services/bookings";
import { parseBookingCsv, parseCsv } from "@/server/integrations/external-booking";
import { passwordPolicyError } from "@/server/auth/password";
import { customerSchema, leadPublicSchema, transactionSchema } from "@/lib/validation";

describe("AI router", () => {
  it("routes to specialists by keywords (he/en)", () => {
    expect(routeRequest("תכתוב לי כיתוב לפוסט באינסטגרם עם האשטאגים").agent).toBe("creative");
    expect(routeRequest("מה הרווח וההוצאות שלי החודש?").agent).toBe("finance");
    expect(routeRequest("build a syllabus for the next academy cohort").agent).toBe("academy");
    expect(routeRequest("plan a meta ads campaign with 1000 budget").agent).toBe("marketing");
    expect(routeRequest("how do I reduce no-show and cancellation").agent).toBe("automation");
    expect(routeRequest("שלום").agent).toBe("ceo");
  });
});

describe("RBAC", () => {
  it("enforces role permissions", () => {
    expect(can("OWNER", "approvals.decide")).toBe(true);
    expect(can("MANAGER", "approvals.decide")).toBe(false);
    expect(can("BARBER", "finance.view")).toBe(false);
    expect(can("ACCOUNTANT", "finance.edit")).toBe(true);
    expect(can("INSTRUCTOR", "academy.edit")).toBe(true);
    expect(can("INSTRUCTOR", "academy.payments")).toBe(false);
    expect(can("VIEWER", "crm.edit")).toBe(false);
    expect(can("MARKETING", "ai.financeData")).toBe(false);
  });
});

describe("appointment state machine", () => {
  it("allows valid transitions only", () => {
    expect(canTransition("SCHEDULED", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "NO_SHOW")).toBe(false);
    expect(canTransition("CANCELLED", "SCHEDULED")).toBe(true);
  });
});

describe("external booking CSV adapter", () => {
  it("parses quoted CSV", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
  });
  it("parses Israeli dates and statuses, reports bad rows", () => {
    const { rows, errors } = parseBookingCsv("date,time,name,phone,service,price,status\n17/11/2026,10:30,Daniel Levi,050-1234567,Haircut,₪100,completed\nbad,,X\n2026-11-20,9:00,Avi,,,,\n");
    expect(rows).toHaveLength(2);
    expect(rows[0].price).toBe(100);
    expect(rows[0].status).toBe("COMPLETED");
    expect(errors).toEqual(["row 3"]);
  });
  it("requires date & name columns", () => {
    expect(parseBookingCsv("foo,bar\n1,2").errors.length).toBe(1);
  });
});

describe("validation", () => {
  it("customer: normalises phone, rejects invalid", () => {
    const ok = customerSchema.parse({ firstName: "דני", phone: "050-1234567", tags: "vip, fade" });
    expect(ok.phone).toBe("+972501234567");
    expect(ok.tags).toEqual(["vip", "fade"]);
    expect(customerSchema.safeParse({ firstName: "x", phone: "12" }).success).toBe(false);
    expect(customerSchema.safeParse({ firstName: "" }).success).toBe(false);
  });
  it("public lead: requires consent and empty honeypot", () => {
    expect(leadPublicSchema.safeParse({ name: "Avi", phone: "0501234567", consent: true }).success).toBe(true);
    expect(leadPublicSchema.safeParse({ name: "Avi", phone: "0501234567", consent: false }).success).toBe(false);
    expect(leadPublicSchema.safeParse({ name: "Avi", phone: "0501234567", consent: true, website: "spam" }).success).toBe(false);
  });
  it("transaction: category must match type", () => {
    expect(transactionSchema.safeParse({ type: "INCOME", kind: "ACTUAL", category: "rent", amount: 5, occurredAt: "2026-11-01" }).success).toBe(false);
    expect(transactionSchema.safeParse({ type: "EXPENSE", kind: "ESTIMATE", category: "rent", amount: 5, occurredAt: "2026-11-01" }).success).toBe(true);
  });
  it("password policy", () => {
    expect(passwordPolicyError("short1")).toBe("password.tooShort");
    expect(passwordPolicyError("onlyletterslong")).toBe("password.weak");
    expect(passwordPolicyError("GoodPass2026")).toBeNull();
  });
});

describe("appointment form schema", () => {
  it("treats empty optional numeric fields as unset", async () => {
    const { appointmentSchema } = await import("@/lib/validation");
    const r = appointmentSchema.parse({ startsAt: "2026-11-20T10:00", durationMin: "", price: "", customerId: "", serviceId: "" });
    expect(r.durationMin).toBeUndefined();
    expect(r.price).toBeUndefined();
    expect(r.customerId).toBeUndefined();
  });
});
