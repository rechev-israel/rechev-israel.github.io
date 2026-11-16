import { ImageResponse } from "next/og";
import { AppIconArt } from "@/components/shell/app-icon";
export const dynamic = "force-static";
export function GET() {
  return new ImageResponse(<AppIconArt size={192} />, { width: 192, height: 192 });
}
