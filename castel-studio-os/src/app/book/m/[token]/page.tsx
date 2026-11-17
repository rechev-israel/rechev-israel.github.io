import type { Metadata } from "next";
import { ManageContent } from "./content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התור שלי — CASTEL STUDIO", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ManageBooking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ManageContent token={token} />;
}
