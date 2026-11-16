"use client";
import { useState } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

type L = { name: string; phone: string; email: string; interested: string; message: string; consent: string; send: string; thanks: string; error: string };

export function LeadForm({ courses, labels }: { courses: { code: string; name: string }[]; labels: L }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), courseCode: fd.get("courseCode"),
        message: fd.get("message"), consent: fd.get("consent") === "on", website: fd.get("website"),
      }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }
  if (state === "done") return <p className="rounded-xl border border-gold/40 bg-gold-soft p-6 text-center text-gold">{labels.thanks}</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div><Label htmlFor="name">{labels.name} *</Label><Input id="name" name="name" required minLength={2} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="phone">{labels.phone} *</Label><Input id="phone" name="phone" type="tel" required dir="ltr" /></div>
        <div><Label htmlFor="email">{labels.email}</Label><Input id="email" name="email" type="email" dir="ltr" /></div>
      </div>
      <div><Label htmlFor="courseCode">{labels.interested}</Label><Select id="courseCode" name="courseCode">{courses.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select></div>
      <div><Label htmlFor="message">{labels.message}</Label><Textarea id="message" name="message" /></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--gold)]" /> {labels.consent}</label>
      <Button type="submit" className="w-full" disabled={state === "sending"}>{state === "sending" ? "…" : labels.send}</Button>
      {state === "error" && <p className="text-xs text-danger">{labels.error}</p>}
    </form>
  );
}
