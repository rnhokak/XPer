import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-12%] h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="flex items-center justify-between">
          <div className="text-lg font-semibold text-foreground">XPer Finance</div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Đăng nhập</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Tạo tài khoản</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-12 lg:grid-cols-[1.1fr,0.9fr] items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Trading journal + Cashflow
              </span>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Ghi lại lệnh, theo dõi cashflow, giữ dữ liệu gọn trên một nơi.
              </h1>
              <p className="text-lg text-muted-foreground">
                Landing page công khai cho khách mới. Người dùng đã đăng nhập sẽ được chuyển thẳng tới dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/auth/register">Bắt đầu miễn phí</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/login">Đăng nhập</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Theo dõi PnL, winrate, lots",
                "Nhật ký lệnh + note nhanh",
                "Quản lý cashflow / accounts",
                "Supabase auth + App Router",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-lg bg-white/80 px-3 py-2 text-sm text-foreground shadow-sm ring-1 ring-black/5"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white/80 p-6 shadow-lg ring-1 ring-black/5">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground/70">Preview</p>
              <h2 className="text-xl font-semibold text-foreground">Dashboard snapshot</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Total PnL", value: "$12,450", tone: "text-emerald-600 bg-emerald-50" },
                { label: "Win rate", value: "58%", tone: "text-foreground bg-slate-50" },
                { label: "Closed trades", value: "214", tone: "text-foreground bg-slate-50" },
                { label: "Cashflow balance", value: "$32,100", tone: "text-foreground bg-slate-50" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl ${item.tone} px-3 py-2 shadow-sm`}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{item.label}</p>
                  <p className="text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border bg-gradient-to-r from-primary/10 to-emerald-50 px-4 py-3 text-sm text-foreground">
              Không cần multi-domain: auth, dashboard và modules chia sẻ cùng domain abc.com.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
