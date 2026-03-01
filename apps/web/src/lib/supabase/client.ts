import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "./types";

// Create a Supabase client for client-side usage (persists auth via cookies)
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createBrowserClient<Database, "public">(supabaseUrl, supabaseAnonKey) as unknown as SupabaseClient<
    Database,
    "public",
    "public",
    Database["public"]
  >;
};
