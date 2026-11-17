"use client";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function PromptWriter({ action, labels, enabled }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; labels: Record<string, string>; enabled: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <form action={formAction} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
        <Select name="kind" aria-label="kind"><option value="image">{labels.image}</option><option value="video">{labels.video}</option><option value="animation">{labels.animation}</option><option value="model3d">3D</option><option value="voiceover">{labels.voiceover}</option></Select>
        <Input name="idea" required minLength={3} placeholder={labels.placeholder} />
        <Button type="submit" variant="outline" disabled={pending || !enabled}><Sparkles size={14} /> {pending ? "…" : labels.write}</Button>
      </form>
      {!enabled && <p className="mt-2 text-[11px] text-muted">{labels.disabled}</p>}
      {state?.error && <p className="mt-2 text-xs text-danger">{state.error}</p>}
      {state?.ok && state.message && <textarea readOnly value={state.message} className="mt-2 h-28 w-full rounded-lg border border-gold/30 bg-surface p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
