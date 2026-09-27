import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { partnerSchema } from "@/lib/validation/debts";

export const dynamic = "force-dynamic";

const getUserAndClient = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
};

export async function GET() {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("accounts")
    .select("id,name,type,currency,is_default,created_at")
    .eq("user_id", user.id)
    .eq("type", "partner")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = partnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { name } = parsed.data;
  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: name.trim(),
    type: "partner",
    currency: "VND",
    is_default: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const parsed = partnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { name } = parsed.data;
  const { error } = await supabase
    .from("accounts")
    .update({ name: name.trim() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Check debts referencing this partner
  const { count: debtCount, error: debtErr } = await supabase
    .from("debts")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", id);

  if (debtErr) return NextResponse.json({ error: debtErr.message }, { status: 500 });
  if (debtCount && debtCount > 0) {
    return NextResponse.json({ error: `Không thể xóa đối tác đang có ${debtCount} hợp đồng vay nợ.` }, { status: 400 });
  }

  // Check transactions referencing this partner
  const { count: txCount, error: txErr } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`account_id.eq.${id},destination_account_id.eq.${id}`);

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
  if (txCount && txCount > 0) {
    return NextResponse.json({ error: `Không thể xóa đối tác đã có ${txCount} giao dịch liên kết.` }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
