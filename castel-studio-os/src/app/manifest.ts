import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CASTEL STUDIO — AI Business OS",
    short_name: "CASTEL",
    description: "CASTEL STUDIO business operating system — CRM, bookings, academy, finance and AI agents.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    dir: "rtl",
    lang: "he",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "לקוחות", url: "/crm" },
      { name: "תורים", url: "/bookings" },
      { name: "האקדמיה", url: "/academy" },
    ],
  };
}
