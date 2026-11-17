import type { Metadata } from "next";
import { BookingPageContent } from "@/app/book/content";
import { AutoHeight } from "../auto-height";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "קביעת תור — CASTEL STUDIO", robots: { index: false, follow: false } };

/** Frameless booking widget, embedded in the business's own website via /embed.js. */
export default function EmbedBook() {
  return <><AutoHeight /><BookingPageContent embed /></>;
}
