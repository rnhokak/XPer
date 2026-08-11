import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RefreshPayload = {
  refresh_token?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = (await req.json().catch(() => ({}))) as RefreshPayload;
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : "";

  if (!refreshToken) {
    return NextResponse.json({ error: "Refresh token is required" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: data.user, session: data.session });
}
