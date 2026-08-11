import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const emailParam = searchParams.get("email") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: emailParam,
      password: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    }
  };

  return (
    <div className="relative min-h-[calc(var(--full-vh))] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#fff7ed_0,_#f1f5f9_45%,_#ecfeff_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute -right-16 bottom-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl motion-safe:animate-pulse" />

      <div className="relative mx-auto flex min-h-[calc(var(--full-vh))] w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8 lg:flex-row lg:items-center lg:gap-12">
        <div className="space-y-6 text-left lg:w-[55%]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">
              XPER LOGIN
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-semibold text-emerald-900">
              Finance + Trading Journal
            </span>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back. Keep your cashflow and trading edge in one place.
            </h1>
            <p className="text-base text-slate-600">
              Sign in to review your dashboard, journal trades, and sync daily transactions with confidence.
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 pt-2 sm:grid sm:grid-cols-2 sm:overflow-visible">
            {[
              "Secure email + password auth",
              "Cashflow and trading KPIs",
              "Session protected by cookies",
              "Clean, responsive mobile layout",
            ].map((item) => (
              <div
                key={item}
                className="min-w-[220px] rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur sm:min-w-0"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-[45%]">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl backdrop-blur">
            <div className="mb-6 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sign in</p>
              <h2 className="text-2xl font-semibold text-slate-900">Access your dashboard</h2>
              <p className="text-sm text-slate-500">Continue where you left off.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
                {errors.email ? <p className="text-sm text-red-500">{errors.email.message}</p> : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <span className="text-xs text-slate-500">Min 6 characters</span>
                </div>
                <Input id="password" type="password" placeholder="******" {...register("password")} />
                {errors.password ? <p className="text-sm text-red-500">{errors.password.message}</p> : null}
              </div>

              {error ? <p className="text-sm text-red-500">{error}</p> : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="mt-4 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link to="/auth/register" className="font-semibold text-emerald-700 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}