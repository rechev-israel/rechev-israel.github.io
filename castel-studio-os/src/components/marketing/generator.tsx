"use client";
import { useActionState, useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function Generator({ action, labels, configured }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  labels: Record<string, string>;
  configured: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <form action={formAction} className="grid gap-2 sm:grid-cols-[160px_140px_1fr_auto] sm:items-end">
        <div><Label>{labels.kind}</Label>
          <Select name="kind" defaultValue="caption">
            <option value="caption">{labels.caption}</option>
            <option value="hashtags">{labels.hashtags}</option>
            <option value="ad">{labels.ad}</option>
            <option value="calendar">{labels.calendar}</option>
            <option value="strategy">{labels.strategy}</option>
          </Select></div>
        <div><Label>{labels.platform}</Label><Select name="platform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook / Meta</option><option value="google">Google</option></Select></div>
        <div><Label>{labels.topic}</Label><Input name="topic" required minLength={3} placeholder={labels.placeholder} /></div>
        <Button type="submit" disabled={pending || !configured}><Sparkles size={14} /> {pending ? "…" : labels.generate}</Button>
      </form>
      {!configured && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">{labels.notConfigured}</p>}
      {state?.error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{state.error}</p>}
      {state?.ok && state.message && (
        <div className="relative rounded-xl border border-gold/30 bg-surface-2 p-4">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(state.message ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute end-3 top-3 inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted hover:text-text" aria-label={labels.copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {labels.copy}
          </button>
          <p className="mb-2 text-[11px] text-gold">{labels.aiLabel}</p>
          <div className="whitespace-pre-wrap pe-16 text-sm leading-relaxed">{state.message}</div>
        </div>
      )}
    </div>
  );
}
