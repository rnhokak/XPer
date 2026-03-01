"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: searchParams.get("email") ?? "",
      password: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword(values);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/dashboard");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr] items-center">
      <div className="space-y-6 text-left">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Finance + Trading Journal
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, let&apos;s track your edge.
          </h1>
          <p className="text-base text-muted-foreground">
            Sign in to view your dashboard, journal trades, and keep your cashflow in sync.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            "Supabase email/password auth",
            "Cashflow + trading overview",
            "Secure session with cookies",
            "Modern UI with Tailwind + shadcn",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <AuthCard title="Sign in" description="Access your dashboard">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            {errors.email ? <p className="text-sm text-red-500">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <span className="text-xs text-muted-foreground">Min 6 characters</span>
            </div>
            <Input id="password" type="password" placeholder="••••••" {...register("password")} />
            {errors.password ? <p className="text-sm text-red-500">{errors.password.message}</p> : null}
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-semibold text-primary hover:underline">
            Create one
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
