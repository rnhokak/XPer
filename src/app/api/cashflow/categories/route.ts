import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, type CategoryInput } from "@/lib/validation/categories";

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

const validateHierarchy = (type: CategoryInput["type"], level: number, parentLevel: number | null) => {
  if (type === "transfer") {
    return level === 0 && parentLevel === null;
  }
  if (level === 0) return parentLevel === null;
  if (level === 1) return parentLevel === 0;
  if (level === 2) return parentLevel === 1;
  return false;
};

export async function GET() {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("categories")
    .select("id,name,type,parent_id,level,is_default,category_focus,created_at")
    .eq("user_id", user.id)
    .order("level", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const { name, type, parent_id, level, category_focus } = parsed.data;

  let parentLevel: number | null = null;
  let parentType: string | null = null;
  if (parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from("categories")
      .select("level,type")
      .eq("id", parent_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 });
    parentLevel = parent?.level ?? null;
    parentType = parent?.type ?? null;
  }

  if (!validateHierarchy(type, level, parentLevel)) {
    return NextResponse.json({ error: "Invalid parent/level combination" }, { status: 400 });
  }
  if (parentType && parentType !== type) {
    return NextResponse.json({ error: "Child category must match parent type" }, { status: 400 });
  }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name: name.trim(),
    type,
    parent_id: parent_id ?? null,
    level,
    category_focus: category_focus ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = categorySchema.safeParse(body);
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });

  const { name, type, parent_id, level, category_focus } = parsed.data;

  let parentLevel: number | null = null;
  let parentType: string | null = null;
  if (parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from("categories")
      .select("level,type")
      .eq("id", parent_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 });
    parentLevel = parent?.level ?? null;
    parentType = parent?.type ?? null;
  }

  if (!validateHierarchy(type, level, parentLevel)) {
    return NextResponse.json({ error: "Invalid parent/level combination" }, { status: 400 });
  }
  if (parentType && parentType !== type) {
    return NextResponse.json({ error: "Child category must match parent type" }, { status: 400 });
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: name.trim(),
      type,
      parent_id: parent_id ?? null,
      level,
      category_focus: category_focus ?? null,
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

  // Check if there are child categories
  const { data: childCategories, error: childError } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", id)
    .eq("user_id", user.id);

  if (childError) return NextResponse.json({ error: childError.message }, { status: 500 });

  if (childCategories && childCategories.length > 0) {
    // Check if we're performing a cascading delete
    const cascade = typeof body.cascade === "boolean" ? body.cascade : false;
    
    if (!cascade) {
      return NextResponse.json({ 
        error: "Category has subcategories. Please delete all subcategories first or use cascade delete." 
      }, { status: 400 });
    }

    // Delete child categories recursively
    for (const child of childCategories) {
      await supabase.from("categories").delete().eq("id", child.id).eq("user_id", user.id);
    }
  }

  // Check if there are transactions associated with this category
  const { count: transactionCount, error: countError } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id)
    .eq("user_id", user.id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  if (transactionCount && transactionCount > 0) {
    return NextResponse.json({ 
      error: `Category has ${transactionCount} associated transactions. Cannot delete category with transactions.` 
    }, { status: 400 });
  }

  const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
