/** Public origin of this deployment (used for OAuth redirect URIs and webhook URLs shown to the owner). */
export function appOrigin(req?: Request) {
  const fixed = process.env.APP_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (fixed) return fixed.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
