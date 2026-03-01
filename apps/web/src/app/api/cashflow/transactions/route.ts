import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cashflowQuickAddSchema } from "@/lib/validation/cashflow";
import { normalizeCashflowRange, normalizeRangeShift, rangeBounds } from "@/lib/cashflow/utils";
import { createCashflowTransaction, updateCashflowTransaction } from "@/features/cashflow/server/transactions";
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

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
};

export async function GET(req: Request) {
  const request = req as unknown as NextRequest;
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return corsResponse(response, request);
  }

  const { searchParams } = new URL(req.url);
  const range = normalizeCashflowRange(searchParams.get("range"));
  const shift = normalizeRangeShift(searchParams.get("shift"));
  const { start, end } = rangeBounds(range, shift);

  let query = supabase
    .from("transactions")
    .select(
      "id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)"
    )
    .eq("user_id", user.id)
    .order("transaction_time", { ascending: false })
    .gte("transaction_time", start.toISOString())
    .lt("transaction_time", end.toISOString());

  const { data, error } = await query;

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
  const parsed = cashflowQuickAddSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    const response = NextResponse.json({ error: message }, { status: 400 });
    return corsResponse(response, request);
  }

  const { data: inserted, error } = await createCashflowTransaction({
    supabase,
    userId: user.id,
    values: parsed.data,
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }

  const response = NextResponse.json(inserted);
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

  const parsed = cashflowQuickAddSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    const response = NextResponse.json({ error: message }, { status: 400 });
    return corsResponse(response, request);
  }

  const { error } = await updateCashflowTransaction({
    supabase,
    userId: user.id,
    transactionId: id,
    values: parsed.data,
  });

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

  const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }

  const response = NextResponse.json({ success: true });
  return corsResponse(response, request);
}
