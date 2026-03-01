import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.NEXT_PUBLIC_CLIENT_URL,
].filter(Boolean) as string[];

export function corsResponse(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Max-Age", "86400");
  
  return response;
}

export function handleCors(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      {},
      {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      }
    );
  }
  
  return NextResponse.json({ error: "CORS not allowed for this origin" }, { status: 403 });
}
