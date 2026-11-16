"use client";
import * as React from "react";
import { startTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

const FormCtx = React.createContext<ActionState>(null);
const PendingCtx = React.createContext(false);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  showSuccess = true,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FormCtx.Provider value={state}>
      <PendingCtx.Provider value={isPending}>
      <form
        ref={ref}
        action={formAction}
        className={className}
        noValidate
        // Dispatch manually so React does not auto-reset fields: users keep their input when validation fails.
        // Without JS the native `action` still works (progressive enhancement).
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => formAction(fd));
        }}
      >
        {children}
        {state?.error && (
          <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && showSuccess && state.message && (
          <p role="status" className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            {state.message}
          </p>
        )}
      </form>
      </PendingCtx.Provider>
    </FormCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const s = React.useContext(FormCtx);
  const msg = s?.fieldErrors?.[name];
  return msg ? <p className="mt-1 text-xs text-danger">{msg}</p> : null;
}

export function SubmitButton({ children, variant = "primary", size = "md", className, pendingLabel }: { children: React.ReactNode; variant?: "primary" | "secondary" | "outline" | "danger" | "ghost"; size?: "sm" | "md"; className?: string; pendingLabel?: string }) {
  const { pending: nativePending } = useFormStatus();
  const pending = nativePending || React.useContext(PendingCtx);
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={cn(className)} aria-busy={pending}>
      {pending ? pendingLabel ?? "…" : children}
    </Button>
  );
}

/** Small inline form for one-click mutations (status changes, toggles). */
export function InlineAction({ action, children, fields, confirm, variant = "ghost", size = "sm", className }: {
  action: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
  fields?: Record<string, string>;
  confirm?: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} className={className}>{children}</SubmitButton>
    </form>
  );
}
