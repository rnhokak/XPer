import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const schema = z
  .object({
    email: z
      .string()
      .min(1, { message: "Vui lòng nhập địa chỉ email" })
      .email({ message: "Địa chỉ email không hợp lệ" }),
    displayName: z
      .string()
      .max(80, { message: "Tên hiển thị không được quá 80 ký tự" })
      .optional()
      .transform((val) => (val?.trim() === "" ? undefined : val?.trim())),
    password: z
      .string()
      .min(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" }),
    confirmPassword: z
      .string()
      .min(1, { message: "Vui lòng xác nhận lại mật khẩu" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
    },
    mode: "onTouched",
  });

  const watchedPassword = watch("password") || "";
  const watchedConfirmPassword = watch("confirmPassword") || "";

  const isLengthValid = watchedPassword.length >= 6;
  const isMatchValid =
    watchedConfirmPassword.length > 0 && watchedPassword === watchedConfirmPassword;

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await signUp(values.email, values.password, values.displayName);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const serverMsg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          (err.response?.status === 400
            ? "Thông tin không hợp lệ hoặc email đã tồn tại"
            : err.message);
        setError(serverMsg);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.");
      }
    }
  };

  return (
    <div className="relative min-h-[100dvh] min-h-[calc(var(--full-vh))] w-full overflow-x-hidden bg-slate-50 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* Dynamic Ambient Background Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#fff7ed_0,_#f8fafc_45%,_#ecfeff_100%)]" />
      <div className="pointer-events-none absolute -left-20 top-12 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl motion-safe:animate-pulse" />

      {/* Top Bar Navigation (Optimized for iOS Safe Area) */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all active:scale-95 hover:bg-white hover:text-slate-900"
          aria-label="Quay lại trang chủ"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Trang chủ</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            XPer Finance
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-6 sm:px-8 lg:py-10">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:gap-14">
          
          {/* Left Column: Branding & Value Props (Hidden or compact on mobile, prominent on desktop) */}
          <div className="hidden space-y-6 text-left lg:block">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/20">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span>Thiết lập tài khoản cá nhân</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl xl:text-5xl">
                Quản lý dòng tiền & nhật ký lệnh tập trung trên một nền tảng.
              </h1>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                Đồng bộ tự động, bảo mật cao cấp với Supabase, tối ưu hóa cho PWA di động và báo cáo tài chính trực quan.
              </p>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {[
                {
                  icon: Wallet,
                  title: "Theo dõi Cashflow",
                  desc: "Thu chi, hạn mức và tài khoản ngân hàng rõ ràng",
                },
                {
                  icon: TrendingUp,
                  title: "Trading Journal",
                  desc: "Ghi chép vị thế, PnL, winrate và bài học giao dịch",
                },
                {
                  icon: ShieldCheck,
                  title: "Bảo mật & Đồng bộ",
                  desc: "Phiên đăng nhập an toàn, cơ chế offline-first",
                },
                {
                  icon: Sparkles,
                  title: "Tối ưu iOS Safari",
                  desc: "Trải nghiệm mượt mà, hỗ trợ Keychain & PWA",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800">{item.title}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: iOS-Optimized Registration Card */}
          <div className="mx-auto w-full max-w-md">
            {/* Mobile-Only Header Brand Banner */}
            <div className="mb-5 text-center lg:hidden">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/20">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Khởi tạo tài khoản mới</span>
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Tạo tài khoản XPer
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Bắt đầu theo dõi thu chi và nhật ký giao dịch miễn phí
              </p>
            </div>

            {/* Registration Card with Frosted Glass Aesthetics */}
            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl backdrop-blur-xl ring-1 ring-slate-900/5 sm:p-8">
              <div className="hidden lg:block mb-6 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Đăng ký nhanh
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Tạo tài khoản mới
                </h2>
                <p className="text-sm text-slate-500">
                  Điền thông tin để bắt đầu quản lý tài chính ngay hôm nay.
                </p>
              </div>

              {/* Error Alert Banner */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-sm text-rose-800 shadow-sm animate-in fade-in-50 duration-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                  <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
                    {error}
                  </div>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* Email Field */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-600"
                  >
                    Địa chỉ Email <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="name@example.com"
                      className={`flex h-12 w-full rounded-xl border bg-slate-50/70 pl-10 pr-3.5 text-[16px] text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                        errors.email
                          ? "border-rose-300 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-500"
                      }`}
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs font-medium text-rose-500">{errors.email.message}</p>
                  )}
                </div>

                {/* Display Name Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="displayName"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-600"
                    >
                      Tên hiển thị
                    </Label>
                    <span className="text-[11px] text-slate-400">Tùy chọn</span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <input
                      id="displayName"
                      type="text"
                      autoComplete="name"
                      autoCapitalize="words"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Ví dụ: Hoàng Long"
                      className={`flex h-12 w-full rounded-xl border bg-slate-50/70 pl-10 pr-3.5 text-[16px] text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                        errors.displayName
                          ? "border-rose-300 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-500"
                      }`}
                      {...register("displayName")}
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-xs font-medium text-rose-500">
                      {errors.displayName.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-600"
                    >
                      Mật khẩu <span className="text-rose-500">*</span>
                    </Label>
                    <span className="text-[11px] text-slate-400">Tối thiểu 6 ký tự</span>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Nhập mật khẩu an toàn"
                      className={`flex h-12 w-full rounded-xl border bg-slate-50/70 pl-10 pr-12 text-[16px] text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                        errors.password
                          ? "border-rose-300 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-500"
                      }`}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex h-full w-12 items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-transform"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs font-medium text-rose-500">{errors.password.message}</p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-600"
                  >
                    Xác nhận mật khẩu <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Nhập lại mật khẩu ở trên"
                      className={`flex h-12 w-full rounded-xl border bg-slate-50/70 pl-10 pr-12 text-[16px] text-slate-900 transition-all placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                        errors.confirmPassword
                          ? "border-rose-300 focus:border-rose-500"
                          : "border-slate-200 focus:border-emerald-500"
                      }`}
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex h-full w-12 items-center justify-center text-slate-400 hover:text-slate-600 active:scale-90 transition-transform"
                      aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs font-medium text-rose-500">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Real-time Password Checklist Indicators */}
                {watchedPassword.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        isLengthValid
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isLengthValid ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      )}
                      <span>Tối thiểu 6 ký tự</span>
                    </div>

                    {watchedConfirmPassword.length > 0 && (
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          isMatchValid
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {isMatchValid ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        )}
                        <span>{isMatchValid ? "Mật khẩu khớp" : "Mật khẩu chưa khớp"}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button (Apple-like feel with active scaling & haptic feedback) */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all duration-150 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Đang tạo tài khoản...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>Đăng ký tài khoản</span>
                      </span>
                    )}
                  </Button>
                </div>
              </form>

              {/* Login Switch Link */}
              <div className="mt-6 border-t border-slate-100 pt-5 text-center">
                <p className="text-sm text-slate-500">
                  Đã có tài khoản?{" "}
                  <Link
                    to="/auth/login"
                    className="font-semibold text-emerald-700 underline-offset-4 hover:underline active:text-emerald-900"
                  >
                    Đăng nhập ngay
                  </Link>
                </p>
              </div>
            </div>

            {/* Terms / Privacy Disclaimer Note */}
            <p className="mt-4 text-center text-[11px] text-slate-400">
              Bằng việc đăng ký, bạn đồng ý với các điều khoản bảo mật và sử dụng của XPer Finance.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Safe Area Margin */}
      <footer className="relative z-10 w-full py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-400">
        © {new Date().getFullYear()} XPer Finance. All rights reserved.
      </footer>
    </div>
  );
}
