import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fundingFormSchema } from "@/lib/validation/trading";

export const dynamic = "force-dynamic";

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

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

export async function GET() {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("trading_funding")
    .select("*")
    .eq("user_id", user.id)
    .order("transaction_time", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = fundingFormSchema.safeParse({
    ...body,
    amount: parseNumber(body.amount),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    user_id: user.id,
    transaction_time: new Date(parsed.data.transaction_time).toISOString(),
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
  };

  const { error } = await supabase.from("trading_funding").insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  }

  const parsed = fundingFormSchema.safeParse({
    ...body,
    amount: parseNumber(body.amount),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    transaction_time: new Date(parsed.data.transaction_time).toISOString(),
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
  };

  const { error } = await supabase
    .from("trading_funding")
    .update(payload)
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("trading_funding")
    .delete()
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
