import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "@/lib/validation/accounts";
import { corsResponse, handleCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

const getUserAndClient = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
};

export async function GET(req: Request) {
  const request = req as unknown as NextRequest;
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return corsResponse(response, request);
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,type,currency,is_default,created_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }
  const response = NextResponse.json(data ?? []);
  return corsResponse(response, request);
}

export async function POST(req: Request) {
  const request = req as unknown as NextRequest;
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return corsResponse(response, request);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    const response = NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    return corsResponse(response, request);
  }

  const { name, type, currency, is_default } = parsed.data;

  if (is_default) {
    await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: name.trim(),
    type: type?.trim() || null,
    currency: currency.trim(),
    is_default: Boolean(is_default),
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }
  const response = NextResponse.json({ success: true });
  return corsResponse(response, request);
}

export async function PUT(req: Request) {
  const request = req as unknown as NextRequest;
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return corsResponse(response, request);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = accountSchema.safeParse(body);
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    const response = NextResponse.json({ error: "Missing id" }, { status: 400 });
    return corsResponse(response, request);
  }
  if (!parsed.success) {
    const response = NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    return corsResponse(response, request);
  }

  const { name, type, currency, is_default } = parsed.data;

  if (is_default) {
    await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: name.trim(),
      type: type?.trim() || null,
      currency: currency.trim(),
      is_default: Boolean(is_default),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }
  const response = NextResponse.json({ success: true });
  return corsResponse(response, request);
}

export async function DELETE(req: Request) {
  const request = req as unknown as NextRequest;
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return corsResponse(response, request);
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    const response = NextResponse.json({ error: "Missing id" }, { status: 400 });
    return corsResponse(response, request);
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }
  const response = NextResponse.json({ success: true });
  return corsResponse(response, request);
}
