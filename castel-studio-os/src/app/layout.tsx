import type { Metadata, Viewport } from "next";
// Fonts are bundled from npm (@fontsource) — no network access needed at build time.
import "@fontsource/heebo/hebrew-400.css";
import "@fontsource/heebo/hebrew-500.css";
import "@fontsource/heebo/hebrew-600.css";
import "@fontsource/heebo/hebrew-700.css";
import "@fontsource/heebo/latin-400.css";
import "@fontsource/heebo/latin-500.css";
import "@fontsource/heebo/latin-600.css";
import "@fontsource/heebo/latin-700.css";
import "@fontsource/frank-ruhl-libre/hebrew-500.css";
import "@fontsource/frank-ruhl-libre/hebrew-700.css";
import "@fontsource/frank-ruhl-libre/hebrew-900.css";
import "@fontsource/frank-ruhl-libre/latin-500.css";
import "@fontsource/frank-ruhl-libre/latin-700.css";
import "@fontsource/frank-ruhl-libre/latin-900.css";
import { getI18n, getTheme } from "@/i18n";
import "./globals.css";


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
    <html lang={locale} dir={dir} data-theme={theme}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
