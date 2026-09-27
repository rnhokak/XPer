import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, updateAccountSchema } from "@/lib/validation/accounts";
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
    .select("id,name,type,currency,balance,is_default,created_at")
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

  const { name, type, currency, balance, is_default } = parsed.data;

  if (is_default) {
    await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: name.trim(),
    type: type.trim(),
    currency: currency.trim(),
    balance: Number(balance) || 0,
    is_default: Boolean(is_default),
  }).select().single();

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }
  const response = NextResponse.json(data ?? { success: true });
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
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    const response = NextResponse.json({ error: "Missing id" }, { status: 400 });
    return corsResponse(response, request);
  }

  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    const response = NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    return corsResponse(response, request);
  }

  const { name, is_default } = parsed.data;

  if (is_default) {
    await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
  }

  // Only update name and is_default. Type is not allowed to be changed.
  const { error } = await supabase
    .from("accounts")
    .update({
      name: name.trim(),
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

  // Check transactions referencing this account (as source or destination)
  const { count: txCount, error: txCheckErr } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`account_id.eq.${id},destination_account_id.eq.${id}`);

  if (txCheckErr) {
    const response = NextResponse.json({ error: txCheckErr.message }, { status: 500 });
    return corsResponse(response, request);
  }

  if (txCount && txCount > 0) {
    const response = NextResponse.json(
      { error: `Không thể xóa tài khoản đã có ${txCount} giao dịch liên kết. Hãy xóa các giao dịch trước.` },
      { status: 400 }
    );
    return corsResponse(response, request);
  }

  // Check debts referencing this account as partner
  const { count: debtCount, error: debtCheckErr } = await supabase
    .from("debts")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", id);

  if (debtCheckErr) {
    const response = NextResponse.json({ error: debtCheckErr.message }, { status: 500 });
    return corsResponse(response, request);
  }

  if (debtCount && debtCount > 0) {
    const response = NextResponse.json(
      { error: `Không thể xóa tài khoản/đối tác đang có ${debtCount} hợp đồng vay nợ.` },
      { status: 400 }
    );
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

