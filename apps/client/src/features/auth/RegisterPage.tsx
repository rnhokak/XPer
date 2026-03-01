import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string(),
    displayName: z
      .string()
      .max(80, { message: "Display name is too long" })
      .optional()
      .transform((val) => (val?.trim() === "" ? undefined : val?.trim())),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await signUp(values.email, values.password, values.displayName);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-6 text-left">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Create your workspace
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Set up your finance and trading journal.
          </h1>
          <p className="text-base text-muted-foreground">
            Register to start tracking cashflow, monitor trades, and view KPIs in one place.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            "Email/password via Supabase",
            "Secure sessions with cookies",
            "Ready for cashflow tracking",
            "Trading journal placeholders",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm shadow-sm ring-1 ring-black/5"
            >
              <span className="h-2 w-2 rounded-full bg-primary" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <AuthCard title="Create account" description="Start tracking finance and trading">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            {errors.email ? <p className="text-sm text-red-500">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input id="displayName" placeholder="Nickname" {...register("displayName")} />
            {errors.displayName ? <p className="text-sm text-red-500">{errors.displayName.message}</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <span className="text-xs text-muted-foreground">Min 6 characters</span>
            </div>
            <Input id="password" type="password" placeholder="••••••" {...register("password")} />
            {errors.password ? <p className="text-sm text-red-500">{errors.password.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
