"use client";
import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";
export function PrintButton({ label }: { label: string }) {
  return <button onClick={() => window.print()} className={buttonClass("secondary")}><Printer size={14} /> {label}</button>;
}
