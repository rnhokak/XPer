import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cashflowQuickAddSchema } from "@/lib/validation/cashflow";
import { normalizeCashflowRange, normalizeRangeShift, rangeBounds } from "@/lib/cashflow/utils";
import { createCashflowTransaction, updateCashflowTransaction, adjustAccountBalance } from "@/features/cashflow/server/transactions";
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
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  let start: Date;
  let end: Date;

  if (fromParam && toParam) {
    const fromDate = new Date(`${fromParam}T00:00:00`);
    const toDate = new Date(`${toParam}T23:59:59.999`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      const response = NextResponse.json({ error: "Ngày không hợp lệ" }, { status: 400 });
      return corsResponse(response, request);
    }
    if (toDate < fromDate) {
      const response = NextResponse.json({ error: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu" }, { status: 400 });
      return corsResponse(response, request);
    }
    // Limit to max 3 months (~93 days)
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 93) {
      const response = NextResponse.json({ error: "Khoảng thời gian tìm kiếm tối đa là 3 tháng" }, { status: 400 });
      return corsResponse(response, request);
    }
    start = fromDate;
    end = toDate;
  } else {
    const range = normalizeCashflowRange(searchParams.get("range"));
    const shift = normalizeRangeShift(searchParams.get("shift"));
    const bounds = rangeBounds(range, shift);
    start = bounds.start;
    end = bounds.end;
  }

  const query = supabase
    .from("transactions")
    .select(
      "id,type,flow_type,transfer_peer_id,amount,currency,note,transaction_time,destination_amount,destination_currency,exchange_rate,destination_account_id,category:categories(id,name,type),account:accounts!transactions_account_id_fkey(id,name,currency,type),destination_account:accounts!transactions_destination_account_id_fkey(id,name,currency,type)"
    )
    .eq("user_id", user.id)
    .order("transaction_time", { ascending: false })
    .gte("transaction_time", start.toISOString())
    .lte("transaction_time", end.toISOString());

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

  const { data: inserted, peer, error } = await createCashflowTransaction({
    supabase,
    userId: user.id,
    values: parsed.data,
  });

  if (error || !inserted) {
    const response = NextResponse.json({ error: error?.message ?? "Error creating transaction" }, { status: 500 });
    return corsResponse(response, request);
  }

  const response = NextResponse.json(peer ? [inserted, peer] : inserted);
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

  // Fetch target transaction
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, transfer_peer_id, type, flow_type, amount, account_id, destination_account_id, destination_amount")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tx) {
    const response = NextResponse.json({ success: true, deletedIds: [id] });
    return corsResponse(response, request);
  }

  const idsToDelete = [id];
  let peerTx = null;
  if (tx.transfer_peer_id) {
    idsToDelete.push(tx.transfer_peer_id);
    const { data: peer } = await supabase
      .from("transactions")
      .select("id, transfer_peer_id, type, flow_type, amount, account_id, destination_account_id, destination_amount")
      .eq("id", tx.transfer_peer_id)
      .eq("user_id", user.id)
      .maybeSingle();
    peerTx = peer;
  }

  // Revert account balances before deleting
  if (tx.type === "transfer") {
    const outflow = tx.flow_type === false ? tx : peerTx;
    const inflow = tx.flow_type === true ? tx : peerTx;

    const sourceAccId = outflow?.account_id;
    const sourceAmount = Number(outflow?.amount) || 0;
    const destAccId = inflow?.account_id ?? outflow?.destination_account_id;
    const destAmount = Number(inflow?.amount ?? outflow?.destination_amount ?? outflow?.amount ?? 0);

    // Revert source (+sourceAmount)
    if (sourceAccId) {
      await adjustAccountBalance(supabase, user.id, sourceAccId, +sourceAmount);
    }
    // Revert dest (-destAmount)
    if (destAccId) {
      await adjustAccountBalance(supabase, user.id, destAccId, -destAmount);
    }
  } else if (tx.type === "expense") {
    // Expense was debited (-), so add back (+)
    if (tx.account_id) {
      await adjustAccountBalance(supabase, user.id, tx.account_id, +Number(tx.amount || 0));
    }
  } else if (tx.type === "income") {
    // Income was credited (+), so deduct (-)
    if (tx.account_id) {
      await adjustAccountBalance(supabase, user.id, tx.account_id, -Number(tx.amount || 0));
    }
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .in("id", idsToDelete)
    .eq("user_id", user.id);

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    return corsResponse(response, request);
  }

  const response = NextResponse.json({ success: true, deletedIds: idsToDelete });
  return corsResponse(response, request);
}
