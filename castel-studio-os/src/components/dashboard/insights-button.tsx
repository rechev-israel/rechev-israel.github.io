"use client";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function InsightsButton({ action, label, disabled }: { action: (s: ActionState) => Promise<ActionState>; label: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-3">
      <button disabled={pending || disabled} className={buttonClass("outline", "sm", "w-full")}><Sparkles size={13} /> {pending ? "…" : label}</button>
      {state?.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
