import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";

const appBasePath = (process.env.NEXT_PUBLIC_APP_BASE_PATH ?? "/app").replace(/\/$/, "");

// Fetch the currently logged-in user (server-side). Returns null when not authenticated.
export const getCurrentUser = async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
};

// Redirect to login when no user is present. Used in protected layouts/pages.
export const requireUser = async (): Promise<User> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${appBasePath}/auth/login`);
  }
  return user;
};
