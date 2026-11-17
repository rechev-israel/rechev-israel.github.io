import type { Metadata } from "next";
import { BookingPageContent } from "./content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "קביעת תור — CASTEL STUDIO אשקלון",
  description: "קביעת תור אונליין לתספורת גברים ב-CASTEL STUDIO, אשקלון.",
  robots: { index: true, follow: true },
};

export default async function BookPage() {
  return <BookingPageContent />;
}
