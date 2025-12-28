import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");
  const allowOrigin = origin ?? "*";
  console.log("[middleware][api]", {
    method: req.method,
    path: req.nextUrl.pathname,
    origin,
  });

  console.log(`CORS Middleware: Allowing origin ${allowOrigin} for ${req.nextUrl.pathname}`);
  console.log("Request Headers:", Object.fromEntries(req.headers.entries()));
  if (req.method === "OPTIONS") {
    const headers = new Headers(CORS_HEADERS);
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Vary", "Origin");
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Vary", "Origin");
  Object.entries(CORS_HEADERS).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
