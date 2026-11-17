import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.VERCEL ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

// Pages under /embed may be framed by the business's own websites (booking widget). Everything else stays DENY.
const embedOrigins = ["'self'", "https://remarkable-sfogliatella-b3c7b4.netlify.app", ...(process.env.EMBED_ALLOWED_ORIGINS ?? "").split(/[\s,]+/).filter((o) => /^https:\/\/[a-z0-9.-]+$/i.test(o) || (!process.env.VERCEL && /^http:\/\/localhost:\d+$/.test(o)))];
const embedHeaders = securityHeaders.filter((h) => h.key !== "X-Frame-Options").concat({ key: "Content-Security-Policy", value: `frame-ancestors ${embedOrigins.join(" ")}` });

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Creative Studio saves rendered graphics (≤ ~3.3 MB data URLs) through Server Actions.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [
      { source: "/((?!embed).*)", headers: securityHeaders },
      { source: "/embed/:path*", headers: embedHeaders },
      { source: "/embed.js", headers: [...embedHeaders, { key: "Cache-Control", value: "public, max-age=300" }] },
      // The service worker must always be revalidated so updates roll out immediately.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
