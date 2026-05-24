import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// In-memory rate limiter: IP → { count, resetAt }
// Resets on cold starts — sufficient for basic brute-force protection.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    if (loginAttempts.size > 10_000) loginAttempts.clear(); // crude eviction to prevent OOM
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate-limit the credentials login callback
  if (pathname === "/api/auth/callback/credentials" && req.method === "POST") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return new NextResponse("Too many login attempts. Try again in 15 minutes.", {
        status: 429,
        headers: { "Retry-After": String(RATE_WINDOW_MS / 1000) },
      });
    }
  }

  const session = req.auth;
  const isAuth = !!session?.user;
  const role = session?.user?.role;

  const homeDest =
    role === "COMPANY_ADMIN"
      ? "/admin"
      : role === "DELIVERY_STAFF"
        ? "/driver"
        : role === "WAREHOUSE_STAFF"
          ? "/warehouse"
          : "/shop";

  // Public routes — redirect authenticated users to their home
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (isAuth) return NextResponse.redirect(new URL(homeDest, req.url));
    return NextResponse.next();
  }

  // API routes not handled above — let them through (auth is enforced in server actions)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!isAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Guard /admin — COMPANY_ADMIN only
  if (pathname.startsWith("/admin") && role !== "COMPANY_ADMIN") {
    return NextResponse.redirect(new URL(homeDest, req.url));
  }

  // Guard /driver — DELIVERY_STAFF only
  if (pathname.startsWith("/driver") && role !== "DELIVERY_STAFF") {
    return NextResponse.redirect(new URL(homeDest, req.url));
  }

  // Guard /warehouse — WAREHOUSE_STAFF only
  if (pathname.startsWith("/warehouse") && role !== "WAREHOUSE_STAFF") {
    return NextResponse.redirect(new URL(homeDest, req.url));
  }

  // Guard /shop and all other authenticated routes — SHOP_OWNER only
  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/driver") &&
    !pathname.startsWith("/warehouse") &&
    role !== "SHOP_OWNER"
  ) {
    return NextResponse.redirect(new URL(homeDest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ikiwi-logo.png).*)"],
};
