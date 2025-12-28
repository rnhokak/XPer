import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RegisterPayload = {
  email?: string;
  password?: string;
  display_name?: string;
  displayName?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = (await req.json().catch(() => ({}))) as RegisterPayload;

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.display_name === "string"
      ? body.display_name.trim()
      : typeof body.displayName === "string"
        ? body.displayName.trim()
        : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email: data.user.email ?? email,
      display_name: displayName || null,
    });
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ user: data.user, session: data.session });
}
