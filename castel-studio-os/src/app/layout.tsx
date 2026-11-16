import type { Metadata, Viewport } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import { getI18n, getTheme } from "@/i18n";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["500", "700", "900"], variable: "--font-frank", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CASTEL STUDIO — AI Business OS", template: "%s · CASTEL STUDIO" },
  description: "CASTEL STUDIO — premium men's barbershop & academy, Ashkelon",
  robots: { index: false, follow: false },
  applicationName: "CASTEL STUDIO",
  appleWebApp: { capable: true, title: "CASTEL", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  manifest: "/manifest.webmanifest",
};

// viewportFit "cover" lets the dark UI extend under the iPhone notch/home bar; safe-area insets are applied in CSS.
export const viewport: Viewport = { themeColor: "#0a0a0b", width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "dark light" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getI18n();
  const theme = await getTheme();
  return (
    <html lang={locale} dir={dir} data-theme={theme} className={`${heebo.variable} ${frank.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
