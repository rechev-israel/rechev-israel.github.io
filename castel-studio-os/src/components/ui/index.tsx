import * as React from "react";
import { cn } from "@/lib/utils";

// ── Button ────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-gold text-[#0a0a0b] hover:bg-gold-strong font-semibold shadow-[0_0_0_1px_rgba(0,0,0,0.2)]",
  secondary: "bg-surface-3 text-text hover:bg-surface-2 border border-border",
  outline: "border border-gold/50 text-gold hover:bg-gold-soft",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30",
};
export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 whitespace-nowrap",
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
    buttonVariants[variant],
    className,
  );
}
export function Button({ variant = "primary", size = "md", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

// ── Form controls ─────────────────────────────────────────
const control = "w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-muted/70 focus:border-gold/70 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-colors";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, "py-2 min-h-20", className)} {...p} />;
});
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-10", className)} {...p} />;
}
export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-muted", className)} {...p} />;
}
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// ── Surfaces ──────────────────────────────────────────────
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5", className)} {...p} />;
}
export function CardTitle({ className, children, action }: { className?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={cn("text-sm font-semibold tracking-wide text-text", className)}>{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between md:gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold [overflow-wrap:anywhere] md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">{actions}</div>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────
type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted border-border",
  gold: "bg-gold-soft text-gold border-gold/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/30",
};
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", tones[tone], className)} {...p} />;
}

// ── Stat ──────────────────────────────────────────────────
export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        {icon && <span className="text-gold/80">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </Card>
  );
}

// ── Table ─────────────────────────────────────────────────
export function Table({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className={cn("w-full text-sm", className)} {...p} />
    </div>
  );
}
export function Th({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("bg-surface-2 px-3 py-2.5 text-start text-xs font-medium text-muted whitespace-nowrap", className)} {...p} />;
}
export function Td({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-t border-border px-3 py-2.5 align-middle", className)} {...p} />;
}

export function EmptyState({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="mb-3 text-gold/70">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-2 max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border px-4 py-3 text-xs leading-relaxed", tones[tone], className)}>{children}</div>;
}
