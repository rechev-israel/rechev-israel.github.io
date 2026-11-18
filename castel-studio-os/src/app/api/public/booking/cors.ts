/** Cross-origin access for the business's own website(s) to the public booking API. Anything else gets no CORS headers. */
const ORIGINS = new Set(["https://remarkable-sfogliatella-b3c7b4.netlify.app", ...(process.env.EMBED_ALLOWED_ORIGINS ?? "").split(/[\s,]+/).filter((o) => /^https:\/\/[a-z0-9.-]+$/i.test(o) || (!process.env.VERCEL && /^http:\/\/localhost:\d+$/.test(o)))]);

export function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin");
  if (!o || !ORIGINS.has(o)) return {};
  return { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", Vary: "Origin" };
}

export const preflight = (req: Request) => new Response(null, { status: 204, headers: cors(req) });

/** Re-wrap a Response with CORS headers. */
export function withCors(req: Request, res: Response) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors(req))) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}
