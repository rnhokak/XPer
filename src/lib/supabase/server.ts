import { createServerClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type Database } from "./types";

// Next 15+ returns a Promise from cookies(); use async factory.
export const createClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const cookieStore = await cookies();

  return createServerClient<Database, "public">(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const store = cookieStore;
        // Some Next runtimes expose only getAll; normalize to string | undefined
        if (typeof (store as any).get === "function") {
          const value = (store as any).get(name);
          return typeof value === "string" ? value : value?.value;
        }
        if (typeof (store as any).getAll === "function") {
          const match = (store as any).getAll().find((c: any) => c?.name === name);
          return typeof match === "string" ? match : match?.value;
        }
        return undefined;
      },
      set(name: string, value: string, options: any) {
        // Wrap in try/catch because cookies() can be immutable in some RSC contexts
        try {
          const cookieOptions = {
            ...options,
            sameSite: "none",
            secure: true,
          };
          const store = cookieStore;
          if (typeof (store as any).set === "function") {
            (store as any).set(name, value, cookieOptions);
          } else if (typeof (store as any).append === "function") {
            // Fallback: some implementations expose append
            (store as any).append(name, value);
          }
        } catch {
          // noop
        }
      },
      remove(name: string, options: any) {
        try {
          const cookieOptions = {
            ...options,
            sameSite: "none",
            secure: true,
          };
          const store = cookieStore;
          if (typeof (store as any).set === "function") {
            (store as any).set(name, "", { ...cookieOptions, maxAge: 0 });
          }
        } catch {
          // noop
        }
      },
    },
  }) as unknown as SupabaseClient<Database, "public", "public", Database["public"]>;
};
