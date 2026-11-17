import type { Metadata } from "next";
import { ManageContent } from "@/app/book/m/[token]/content";
import { AutoHeight } from "../../../auto-height";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "התור שלי — CASTEL STUDIO", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function EmbedManage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <><AutoHeight scrollTop /><ManageContent token={token} embed /></>;
}
