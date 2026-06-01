import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySessionCookie } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.includes("/webhook")) return true;
  return false;
}

function hasApiSecret(req: NextRequest): boolean {
  const expected = process.env.API_SECRET || process.env.CRON_SECRET;
  const got = req.headers.get("x-api-secret");
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return Boolean(expected && ((got && got === expected) || (bearer && bearer === expected)));
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function isStateChanging(req: NextRequest): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(req.method);
}

function hasCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.nextUrl.host;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return noStore(NextResponse.next());
  if (pathname.startsWith("/api/") && hasApiSecret(req)) return noStore(NextResponse.next());
  if (pathname.startsWith("/api/") && isStateChanging(req) && hasCrossOrigin(req)) {
    return noStore(NextResponse.json({ error: "forbidden-origin" }, { status: 403 }));
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const ok = await verifySessionCookie(token);
  if (ok) return noStore(NextResponse.next());

  // API routes: 401 JSON. Pages: redirect to /login.
  if (pathname.startsWith("/api/")) {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return noStore(NextResponse.redirect(url));
}

export const config = {
  // Skip static assets, _next, favicon. Everything else runs middleware.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map)$).*)"],
};
