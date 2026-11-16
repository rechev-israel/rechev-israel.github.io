import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/shell/app-icon";
export const dynamic = "force-static";
// Maskable icons need the artwork inside the central 80% "safe zone"; AppIconArt keeps it at 62%.
export function GET() {
  return new ImageResponse(<AppIconArt size={512} />, { width: 512, height: 512 });
}
