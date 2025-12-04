"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ChevronLeft, ChevronRight, Gauge, HandCoins, LogOut, Menu, Settings, Wallet } from "lucide-react";
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

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  {
    href: "/cashflow",
    label: "Cashflow",
    icon: Wallet,
    children: [
      { href: "/cashflow", label: "Transactions" },
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
      { href: "/trading/funding", label: "Funding History" },
      { href: "/trading/orders", label: "Orders" },
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
  children: React.ReactNode;
  userEmail?: string | null;
  userDisplayName?: string | null;
}

// Layout for authenticated pages with responsive sidebar, collapse toggle, and user menu
export default function MainLayout({ children, userEmail, userDisplayName }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const preferredName = userDisplayName || userEmail || "User";
  const initials = useMemo(() => preferredName.charAt(0).toUpperCase(), [preferredName]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }, [router]);

  const handleNavClick = useCallback(() => {
    closeSidebar();
  }, [closeSidebar]);

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

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <aside
        className={cn(
          "fixed inset-y-0 z-20 flex flex-col border-r bg-white/90 shadow-sm backdrop-blur transition-all duration-200",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-[4.5rem]" : "w-64",
          "md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              X
            </span>
            {!isCollapsed && <span className="text-lg">XPer</span>}
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setIsCollapsed((v) => !v)}
              aria-label="Collapse sidebar"
            >
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || item.children?.some((child) => pathname.startsWith(child.href));

            return (
              <div key={item.href} className="space-y-1">
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active && "bg-primary/10 text-primary shadow-sm"
                  )}
                >
                  <Icon className="h-4 w-4 transition-transform group-hover:scale-105" />
                  {!isCollapsed && item.label}
                  
                </Link>

                {item.children && !isCollapsed ? (
                  <div className="ml-9 space-y-1">
                    {item.children.map((child) => {
                      const childActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={handleNavClick}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                            childActive && "bg-primary/10 text-primary"
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
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

        <div className="border-t px-3 py-3">
          <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/70 px-3 py-2 text-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="space-y-0.5">
                <p className="font-medium text-sm">{preferredName}</p>
                <p className="text-xs text-muted-foreground">Logged in</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay to close sidebar on outside click */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-10 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col transition-all duration-200",
          isCollapsed ? "md:pl-[4.5rem]" : "md:pl-64"
        )}
      >
        <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-white/90 px-3 sm:px-4 shadow-sm backdrop-blur">
          <div className="flex flex-1 items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar} aria-label="Toggle menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Welcome back</p>
              <p className="text-base font-semibold">{preferredName}</p>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-indigo-500 text-sm font-semibold text-white shadow-sm">
                {initials}
              </span>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight">{preferredName}</p>
                <p className="text-xs text-muted-foreground leading-tight">Account menu</p>
              </div>
            </Button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg ring-1 ring-black/5">
                <div className="px-3 py-2 text-sm">
                  <p className="font-semibold">{preferredName}</p>
                  <p className="text-xs text-muted-foreground">Signed in</p>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm hover:bg-primary/10"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
