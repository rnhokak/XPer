import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeCashflowRange, normalizeRangeShift, rangeBounds } from "@/lib/cashflow/utils";
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

  const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,type,currency,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id,name,type,parent_id,is_default,category_focus")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id,type,amount,currency,note,transaction_time,category_id,account_id")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("transaction_time", start.toISOString())
      .lt("transaction_time", end.toISOString())
      .order("transaction_time", { ascending: false }),
  ]);

  if (accountsRes.error || categoriesRes.error || transactionsRes.error) {
    const message = accountsRes.error?.message ?? categoriesRes.error?.message ?? transactionsRes.error?.message ?? "Failed to fetch reports data";
    const response = NextResponse.json({ error: message }, { status: 500 });
    return corsResponse(response, request);
  }

  const response = NextResponse.json({
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    transactions: transactionsRes.data ?? [],
  });
  return corsResponse(response, request);
}
