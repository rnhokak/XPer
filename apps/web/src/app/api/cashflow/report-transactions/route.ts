import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

const reportRangeStart = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

export async function GET(req: Request) {
  const request = req as unknown as NextRequest;
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return corsResponse(response, request);
  }

  const start = reportRangeStart();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,type,flow_type,transfer_peer_id,amount,currency,note,transaction_time,destination_amount,destination_currency,exchange_rate,destination_account_id,category:categories(id,name,type),account:accounts!transactions_account_id_fkey(id,name,currency,type),destination_account:accounts!transactions_destination_account_id_fkey(id,name,currency,type)"
    )
    .eq("user_id", user.id)
    .gte("transaction_time", start.toISOString())
    .order("transaction_time", { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }

  const response = NextResponse.json(data ?? []);
  return corsResponse(response, request);
}
