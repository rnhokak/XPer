import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_CLIENT_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3005",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3005",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean) as string[];

const ENV_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? [];

const ALLOWED_ORIGINS = Array.from(
  new Set([...DEFAULT_ALLOWED_ORIGINS, ...ENV_ALLOWED_ORIGINS]),
);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");
  const isAllowedOrigin = origin ? ALLOWED_ORIGINS.includes(origin) : true;

  if (origin && !isAllowedOrigin) {
    return new NextResponse("CORS origin denied", { status: 403 });
  }

  const allowOrigin = origin ?? "";

  if (req.method === "OPTIONS") {
    const headers = new Headers(CORS_HEADERS);
    const requestedHeaders = req.headers.get("access-control-request-headers");
    if (requestedHeaders) {
      headers.set("Access-Control-Allow-Headers", requestedHeaders);
    }
    if (allowOrigin) {
      headers.set("Access-Control-Allow-Origin", allowOrigin);
      headers.set("Vary", "Origin");
    }
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  if (allowOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowOrigin);
    response.headers.set("Vary", "Origin");
  }
  Object.entries(CORS_HEADERS).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
