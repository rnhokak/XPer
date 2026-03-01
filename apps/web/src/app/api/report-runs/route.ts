import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportRunCreateSchema, reportRunUpdateSchema } from "@/lib/validation/report";

export const dynamic = "force-dynamic";

const parseReportDate = (value?: string) => {
  if (!value) return new Date();
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return null;
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  if ([parsedYear, parsedMonth, parsedDay].some((n) => Number.isNaN(n))) return null;
  return new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay, 0, 0, 0));
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

export async function GET(_req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("report_runs")
    .select("id,type,report_date,note,created_at")
    .eq("user_id", user.id)
    .order("report_date", { ascending: false })
    .limit(50);

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
  const parsed = reportRunCreateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const resolvedDate = parseReportDate(parsed.data.report_date);
  if (!resolvedDate) {
    return NextResponse.json({ error: "Invalid report_date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("report_runs")
    .insert({
      user_id: user.id,
      type: parsed.data.type,
      report_date: resolvedDate.toISOString(),
      note: parsed.data.note?.trim() || null,
    })
    .select("id,type,report_date,note,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = reportRunUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const resolvedDate = parseReportDate(parsed.data.report_date);
  if (!resolvedDate) {
    return NextResponse.json({ error: "Invalid report_date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("report_runs")
    .update({
      type: parsed.data.type,
      report_date: resolvedDate.toISOString(),
      note: parsed.data.note?.trim() || null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id,type,report_date,note,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { supabase, user } = await getUserAndClient();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("report_runs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
