import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { createBalanceAccountSchema, updateBalanceAccountSchema } from "@/lib/validation/balance";
import type { Database } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const dynamic = "force-dynamic";

const selectWithDetails =
  "id,account_type,name,currency,is_active,created_at,broker,platform,account_number,is_demo,funding_accounts(id,provider,note)";

const fetchAccount = async (supabase: Supabase, id: string, userId: string) => {
  const { data, error } = await supabase
    .from("balance_accounts")
    .select("id,account_type,user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Account not found" };
  if (data.user_id !== userId) return { error: "Unauthorized" };
  return { account: data };
};

export async function GET() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("balance_accounts")
    .select(selectWithDetails)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const parsed = createBalanceAccountSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    account_type: parsed.data.account_type ?? "TRADING",
    name: parsed.data.name.trim(),
    currency: parsed.data.currency.trim(),
    is_active: parsed.data.is_active ?? true,
    broker: parsed.data.broker ?? null,
    platform: parsed.data.platform ?? null,
    account_number: parsed.data.account_number ?? null,
    is_demo: parsed.data.is_demo ?? false,
  };

  const { data: accountRows, error: insertErr } = await supabase.from("balance_accounts").insert(payload).select("id");
  if (insertErr || !accountRows?.[0]) {
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create account" }, { status: 500 });
  }
  const balanceAccountId = accountRows[0].id as string;

  if (payload.account_type === "FUNDING") {
    const { error: detailErr } = await supabase.from("funding_accounts").insert({
      balance_account_id: balanceAccountId,
      provider: null,
      note: null,
    });
    if (detailErr) {
      await supabase.from("balance_accounts").delete().eq("id", balanceAccountId);
      return NextResponse.json({ error: detailErr.message }, { status: 500 });
    }
  }

  const { data: created } = await supabase
    .from("balance_accounts")
    .select(selectWithDetails)
    .eq("id", balanceAccountId)
    .maybeSingle();

  return NextResponse.json(created ?? { id: balanceAccountId });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));

  const parsed = updateBalanceAccountSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { account, error } = await fetchAccount(supabase, parsed.data.id, user.id);
  if (error) {
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 403 : 404 });
  }

  if (parsed.data.account_type && parsed.data.account_type !== account!.account_type) {
    return NextResponse.json({ error: "Changing account_type is not allowed" }, { status: 400 });
  }

  const updatePayload: Partial<Database["public"]["Tables"]["balance_accounts"]["Update"]> = {
    name: parsed.data.name?.trim(),
    currency: parsed.data.currency?.trim(),
    is_active: parsed.data.is_active,
    broker: parsed.data.broker,
    platform: parsed.data.platform,
    account_number: parsed.data.account_number,
    is_demo: parsed.data.is_demo,
  };

  const { error: updateErr } = await supabase.from("balance_accounts").update(updatePayload).eq("id", parsed.data.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (account!.account_type === "FUNDING") {
    const { error: detailErr } = await supabase
      .from("funding_accounts")
      .upsert(
        {
          balance_account_id: parsed.data.id,
          provider: null,
          note: null,
        },
        { onConflict: "balance_account_id" }
      );
    if (detailErr) {
      return NextResponse.json({ error: detailErr.message }, { status: 500 });
    }
  }

  const { data: updated } = await supabase.from("balance_accounts").select(selectWithDetails).eq("id", parsed.data.id).maybeSingle();
  return NextResponse.json(updated ?? { success: true });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const id = body.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  const { error } = await fetchAccount(supabase, id, user.id);
  if (error) {
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 403 : 404 });
  }

  const { error: updateErr } = await supabase.from("balance_accounts").update({ is_active: false }).eq("id", id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
