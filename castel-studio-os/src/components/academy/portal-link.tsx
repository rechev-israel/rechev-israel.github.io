"use client";
import { useActionState, useState } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function PortalLinkButton({ action, label, hasLink }: { action: (s: ActionState) => Promise<ActionState>; label: { create: string; rotate: string; copy: string }; hasLink: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);
  const url = state?.ok ? state.message?.split("\n").pop() : null;
  return (
    <div>
      <form action={formAction}><button disabled={pending} className={buttonClass("outline", "sm")}><Link2 size={13} /> {pending ? "…" : hasLink ? label.rotate : label.create}</button></form>
      {state?.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
      {url && (
        <div className="mt-2 rounded-lg border border-gold/40 bg-gold-soft/40 p-2 text-xs">
          <p className="mb-1 whitespace-pre-wrap text-muted">{state?.message?.split("\n")[0]}</p>
          <div className="flex items-center gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all text-gold">{url}</code>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }} className={buttonClass("ghost", "sm")}>{copied ? <Check size={13} /> : <Copy size={13} />} {label.copy}</button></div>
        </div>
      )}
    </div>
  );
}
