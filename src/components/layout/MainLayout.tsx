"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Gauge, HandCoins, LogOut, Menu, Plus, PlusCircle, Settings, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/store/ui";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
};

type AddAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  event?: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  {
    href: "/cashflow",
    label: "Cashflow",
    icon: Wallet,
    children: [
      { href: "/cashflow", label: "Transactions" },
      { href: "/cashflow/new", label: "Add Transaction" },
      { href: "/cashflow/accounts", label: "Accounts" },
      { href: "/cashflow/categories", label: "Categories" },
    ],
  },
  {
    href: "/debts",
    label: "Debts",
    icon: HandCoins,
    children: [
      { href: "/debts", label: "Danh sách" },
      { href: "/debts/new", label: "Khoản mới" },
      { href: "/debts/partners", label: "Đối tác" },
    ],
  },
  {
    href: "/trading",
    label: "Trading",
    icon: BarChart3,
    children: [
      { href: "/trading/dashboard", label: "Dashboard" },
      { href: "/trading/accounts", label: "Balance Accounts" },
      { href: "/trading/funding", label: "Funding History" },
      { href: "/trading/orders", label: "Orders" },
      { href: "/trading/ledger", label: "Ledger" },
    ],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { href: "/settings/profile", label: "Profile" },
      { href: "/settings", label: "General" },
    ],
  },
];

interface MainLayoutProps {
  children: ReactNode;
  userEmail?: string | null;
  userDisplayName?: string | null;
}

// Mobile-first layout with bottom navigation and a compact sidebar for larger screens
export default function MainLayout({ children, userEmail, userDisplayName }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const preferredName = userDisplayName || userEmail || "User";
  const initials = useMemo(() => preferredName.charAt(0).toUpperCase(), [preferredName]);
  const bottomNavItems = useMemo(() => navItems.filter((item) => item.href !== "/settings"), []);

  const activeNav = useMemo(() => {
    const exact = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (exact) return exact;
    return (
      navItems.find((item) =>
        item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))
      ) ?? null
    );
  }, [pathname]);

  const addAction = useMemo<AddAction | null>(() => {
    if (pathname.startsWith("/cashflow") && !pathname.startsWith("/cashflow/new")) {
      return { label: "Add giao dịch", icon: PlusCircle, href: "/cashflow/new" };
    }
    if (pathname.startsWith("/trading/orders")) {
      return { label: "Add order", icon: PlusCircle, event: "trading:orders:new" };
    }
    if (pathname.startsWith("/trading/funding")) {
      return { label: "Log funding", icon: PlusCircle, event: "trading:funding:new" };
    }
    if (pathname.startsWith("/debts")) {
      return { label: "Khoản mới", icon: PlusCircle, href: "/debts/new" };
    }
    return null;
  }, [pathname]);
  const AddIcon = addAction?.icon ?? null;

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }, [router]);

  // Close user menu on outside click or Escape
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleAddAction = useCallback(() => {
    if (!addAction) return;
    if (addAction.href) {
      closeSidebar();
      router.push(addAction.href);
      return;
    }
    if (addAction.event && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("xper:add", { detail: addAction.event }));
    }
  }, [addAction, closeSidebar, router]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-72 transform overflow-y-auto border-r border-slate-200 bg-white/90 px-3 py-4 shadow-lg backdrop-blur transition-transform duration-200",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-1 pb-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-base font-semibold text-white shadow-sm">
              xP
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">XPer Finance</p>
              <p className="text-xs text-muted-foreground">iOS-first workspace</p>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar} aria-label="Đóng menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));

            return (
              <div key={item.href} className="space-y-1">
                <Link
                  href={item.href}
                  onClick={closeSidebar}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-slate-100 hover:text-foreground",
                    active && "bg-emerald-50 text-emerald-700 shadow-sm"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("h-4 w-4", active && "text-emerald-600")} />
                  {item.label}
                </Link>

                {item.children ? (
                  <div className="ml-8 space-y-1">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeSidebar}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-slate-100 hover:text-foreground",
                            childActive && "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              {initials}
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">{preferredName}</p>
              <p className="text-xs text-muted-foreground">Đang đăng nhập</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="mt-3 w-full justify-start gap-2 text-sm text-emerald-700 hover:bg-emerald-50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Đóng sidebar"
          className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col md:pl-72">
        <header
          className="sticky z-40 border-b border-slate-200 bg-white/90 backdrop-blur"
          style={{ top: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-2 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar} aria-label="Mở menu">
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-xs text-muted-foreground">{activeNav?.label ?? "XPer"}</p>
                <p className="text-base font-semibold leading-tight">{preferredName}</p>
              </div>
            </div>

            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white shadow-sm">
                  {initials}
                </span>
                <span className="hidden text-sm font-medium sm:inline">{preferredName}</span>
              </Button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg ring-1 ring-black/5">
                  <div className="px-3 py-2 text-sm">
                    <p className="font-semibold">{preferredName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail ?? "Signed in"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-sm hover:bg-emerald-50"
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-2 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-4 sm:px-6 md:max-w-5xl md:pb-12">
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2 shadow-2xl backdrop-blur md:hidden">
        <div className="relative mx-auto max-w-lg pt-6">
          {addAction && AddIcon ? (
            <div className="pointer-events-none absolute left-1/2 top-0 z-50 flex -translate-x-1/2 -translate-y-6 items-center justify-center">
              <button
                type="button"
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(16,185,129,0.35)] ring-2 ring-emerald-200/80 transition hover:scale-[1.02] active:scale-[0.99]"
                onClick={handleAddAction}
                aria-label={addAction.label}
              >
                <AddIcon className="h-5 w-5" />
                <span>{addAction.label}</span>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/90 px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.14)] backdrop-blur">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[12px] font-semibold transition min-h-[52px]",
                    active
                      ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100"
                      : "text-slate-500 hover:bg-slate-100"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("h-5 w-5", active && "text-emerald-600")} />
                  <span className="leading-none">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
