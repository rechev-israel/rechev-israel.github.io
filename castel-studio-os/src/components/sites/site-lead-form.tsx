"use client";
import { useState } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";

export function SiteLeadForm({ kind, source, labels }: { kind: "barbershop" | "academy"; source: string; labels: Record<string, string> }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    const res = await fetch("/api/public/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), message: fd.get("message"), consent: fd.get("consent") === "on", website: fd.get("website"), kind, source }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }
  if (state === "done") return <p className="rounded-xl border border-gold/40 bg-gold-soft p-5 text-center text-gold">{labels.thanks}</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>{labels.name} *</Label><Input name="name" required minLength={2} /></div>
        <div><Label>{labels.phone} *</Label><Input name="phone" type="tel" required dir="ltr" /></div>
      </div>
      <div><Label>{labels.email}</Label><Input name="email" type="email" dir="ltr" /></div>
      <div><Label>{labels.message}</Label><Textarea name="message" rows={3} /></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--gold)]" /> {labels.consent}</label>
      <Button type="submit" className="w-full" disabled={state === "sending"}>{state === "sending" ? "…" : labels.send}</Button>
      {state === "error" && <p className="text-xs text-danger">{labels.error}</p>}
    </form>
  );
}
