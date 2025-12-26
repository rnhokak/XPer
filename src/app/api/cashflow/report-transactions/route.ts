import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = reportRangeStart();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id,type,amount,currency,note,transaction_time,category:categories(id,name,type),account:accounts(id,name,currency)"
    )
    .eq("user_id", user.id)
    .gte("transaction_time", start.toISOString())
    .order("transaction_time", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
