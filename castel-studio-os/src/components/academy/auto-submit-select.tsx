"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** A <select> inside a server-action form that submits on change (progressive: works without JS via the button). */
export function AutoSubmitSelect({ action, fields, name, value, options, className, label }: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select
        aria-label={label}
        name={name}
        defaultValue={value}
        onChange={() => ref.current?.requestSubmit()}
        className={cn("h-8 w-full rounded-md border border-border bg-surface-2 px-1.5 text-xs focus:border-gold/60 focus:outline-none", className)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <noscript><button type="submit">✓</button></noscript>
    </form>
  );
}
