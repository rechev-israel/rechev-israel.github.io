import { NextResponse, type NextRequest } from "next/server";

// Edge pre-check only: cookie presence. Real validation (DB session, role) happens server-side.
const PUBLIC = [/^\/login/, /^\/setup/, /^\/join(\/|$)/, /^\/portal\//, /^\/api\/public\//, /^\/api\/health/, /^\/api\/cron\//, /^\/api\/integrations\/cali\/webhook$/, /^\/_next\//, /^\/favicon/, /^\/icon/, /^\/apple-icon/, /^\/manifest\.webmanifest$/, /^\/icons\//, /^\/sw\.js$/, /^\/offline\.html$/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  if (!req.cookies.get("castel_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|icons/|apple-icon|manifest.webmanifest|sw.js|offline.html).*)"] };
