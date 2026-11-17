"use client";
import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ActionState } from "@/lib/validation";

/** Form that shows the server action's text result in a copyable panel (used for AI outputs). */
export function ResultForm({ action, children, className, copyLabel = "Copy" }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; children: React.ReactNode; className?: string; copyLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <form action={formAction} className={className} aria-busy={pending}>{children}</form>
      {pending && <p className="mt-2 animate-pulse text-xs text-muted">…</p>}
      {state?.error && <p role="alert" className="mt-2 rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{state.error}</p>}
      {state?.ok && state.message && (
        <div className="relative mt-2 rounded-xl border border-gold/30 bg-surface-2 p-3">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(state.message ?? ""); setCopied(true); }} className="absolute end-2 top-2 inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted">{copied ? <Check size={12} /> : <Copy size={12} />} {copyLabel}</button>
          <p className="whitespace-pre-wrap pe-16 text-sm leading-relaxed">{state.message}</p>
        </div>
      )}
    </div>
  );
}
