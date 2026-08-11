import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { partnerSchema } from "@/lib/validation/debts";
import { ensurePartnerCategory } from "@/features/debts/server/partner-category";

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
    .from("partners")
    .select("id,name,type,phone,note,category_id,created_at")
    .eq("user_id", user.id)
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

  const { name, type, phone, note } = parsed.data;
  const { id: categoryId, error: categoryError } = await ensurePartnerCategory(supabase, user.id, { name });
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });

  const { error } = await supabase.from("partners").insert({
    user_id: user.id,
    name: name.trim(),
    type: type?.trim() || null,
    phone: phone?.trim() || null,
    note: note?.trim() || null,
    category_id: categoryId,
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

  const { name, type, phone, note } = parsed.data;
  const { data: existing, error: existingError } = await supabase
    .from("partners")
    .select("category_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { id: categoryId, error: categoryError } = await ensurePartnerCategory(supabase, user.id, {
    name,
    category_id: existing.category_id,
  });
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });

  const { error } = await supabase
    .from("partners")
    .update({
      name: name.trim(),
      type: type?.trim() || null,
      phone: phone?.trim() || null,
      note: note?.trim() || null,
      category_id: categoryId,
    })
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

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("id,category_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (partnerError) return NextResponse.json({ error: partnerError.message }, { status: 500 });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { error } = await supabase.from("partners").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categoryId = partner.category_id;
  if (categoryId) {
    const [txCountRes, partnerCountRes, childCountRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category_id", categoryId),
      supabase
        .from("partners")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category_id", categoryId),
      supabase
        .from("categories")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("parent_id", categoryId),
    ]);

    if (!txCountRes.error && !partnerCountRes.error && !childCountRes.error) {
      const txCount = txCountRes.count ?? 0;
      const partnerCount = partnerCountRes.count ?? 0;
      const childCount = childCountRes.count ?? 0;

      if (txCount === 0 && partnerCount === 0 && childCount === 0) {
        const { data: category } = await supabase
          .from("categories")
          .select("id,type")
          .eq("user_id", user.id)
          .eq("id", categoryId)
          .maybeSingle();

        if (category?.type === "debt") {
          await supabase.from("categories").delete().eq("id", categoryId).eq("user_id", user.id);
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
