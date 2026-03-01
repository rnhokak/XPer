# Chi tiết Subtasks - Pages Migration

**Mục tiêu:** Chuyển đổi tất cả pages từ Next.js App Router sang React Router v6

---

## 📑 Mục lục

1. [Auth Pages](#1-auth-pages)
2. [Public Pages](#2-public-pages)
3. [Protected Layout](#3-protected-layout)
4. [Dashboard Page](#4-dashboard-page)
5. [Cashflow Module](#5-cashflow-module)
6. [Debts Module](#6-debts-module)
7. [Trading Module](#7-trading-module)
8. [Reports Module](#8-reports-module)
9. [Settings Module](#9-settings-module)

---

## 1. AUTH PAGES

### 1.1 Login Page

**File nguồn:** `src/app/(auth)/auth/login/page.tsx`
**File đích:** `src/features/auth/LoginPage.tsx`

#### Subtasks:

- [ ] **1.1.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  import { useRouter, useSearchParams } from "next/navigation";
  
  // ✅ Thay bằng
  import { Link, useSearchParams, useNavigate } from "react-router-dom";
  ```

- [ ] **1.1.2** Replace hooks
  ```typescript
  // Next.js
  const router = useRouter();
  
  // React Router
  const navigate = useNavigate();
  ```

- [ ] **1.1.3** Update navigation calls
  ```typescript
  // Next.js
  router.replace("/dashboard");
  
  // React Router
  navigate("/dashboard", { replace: true });
  ```

- [ ] **1.1.4** Remove `"use client"` directive (không cần trong Vite)

- [ ] **1.1.5** Remove `Suspense` wrapper (không cần thiết nếu không dùng React.lazy)

- [ ] **1.1.6** Update Supabase client import (nếu cần)
  ```typescript
  import { supabase } from '@/lib/supabase/client'
  // Dùng instance thay vì createClient()
  ```

- [ ] **1.1.7** Test login flow
  - Nhập email/password hợp lệ → redirect về `/dashboard`
  - Nhập sai password → hiển thị error
  - Kiểm tra session được lưu

---

### 1.2 Register Page

**File nguồn:** `src/app/(auth)/auth/register/page.tsx`
**File đích:** `src/features/auth/RegisterPage.tsx`

#### Subtasks:

- [ ] **1.2.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  import { useRouter } from "next/navigation";
  
  // ✅ Thay bằng
  import { Link, useNavigate } from "react-router-dom";
  ```

- [ ] **1.2.2** Replace router hook
  ```typescript
  const navigate = useNavigate();
  ```

- [ ] **1.2.3** Update navigation
  ```typescript
  navigate("/dashboard", { replace: true });
  ```

- [ ] **1.2.4** Remove `"use client"` directive

- [ ] **1.2.5** Update profile upsert logic
  ```typescript
  // Đảm bảo supabase client được import đúng
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, display_name: displayName });
  ```

- [ ] **1.2.6** Test register flow
  - Tạo tài khoản mới
  - Kiểm tra profile được tạo trong DB
  - Kiểm tra redirect sau khi đăng ký

---

### 1.3 Auth Layout

**File nguồn:** `src/app/(auth)/layout.tsx`
**File đích:** `src/features/auth/AuthLayout.tsx`

#### Subtasks:

- [ ] **1.3.1** Remove TypeScript type imports từ React
  ```typescript
  // ❌ Xóa
  import type { ReactNode } from "react";
  
  // ✅ Thay bằng
  import { ReactNode } from "react";
  ```

- [ ] **1.3.2** Keep layout structure unchanged (chỉ là wrapper UI)

- [ ] **1.3.3** Update route config để wrap auth pages với AuthLayout
  ```typescript
  // Trong router/index.tsx
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/register', element: <RegisterPage /> },
    ]
  }
  ```

---

## 2. PUBLIC PAGES

### 2.1 Landing Page

**File nguồn:** `src/app/(public)/page.tsx`
**File đích:** `src/features/public/LandingPage.tsx`

#### Subtasks:

- [ ] **2.1.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  import { redirect } from "next/navigation";
  import { getCurrentUser } from "@/lib/auth";
  
  // ✅ Thay bằng
  import { Link, useNavigate } from "react-router-dom";
  import { useAuth } from "@/hooks/useAuth";
  ```

- [ ] **2.1.2** Convert từ server component sang client component
  ```typescript
  // Thêm useEffect để check auth
  import { useEffect } from 'react';
  
  export default function LandingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
      if (user) {
        navigate("/dashboard", { replace: true });
      }
    }, [user, navigate]);
    
    // ... rest of component
  }
  ```

- [ ] **2.1.3** Remove server-side redirect logic
  ```typescript
  // ❌ Xóa
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }
  ```

- [ ] **2.1.4** Test landing page
  - Hiển thị đúng nội dung khi chưa login
  - Tự động redirect khi đã login

---

## 3. PROTECTED LAYOUT

### 3.1 ProtectedRoute Component

**File mới:** `src/components/auth/ProtectedRoute.tsx`

#### Subtasks:

- [ ] **3.1.1** Create ProtectedRoute component
  ```typescript
  import { Navigate, Outlet } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  import MainLayout from '@/components/layout/MainLayout';
  import { Loader2 } from 'lucide-react';
  
  export default function ProtectedRoute() {
    const { user, loading } = useAuth();
    
    if (loading) {
      return (
        <div className="flex h-screen w-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (!user) {
      return <Navigate to="/auth/login" replace />;
    }
    
    return (
      <MainLayout userEmail={user.email} userDisplayName={null}>
        <Outlet />
      </MainLayout>
    );
  }
  ```

- [ ] **3.1.2** Test protected route
  - Truy cập `/dashboard` khi chưa login → redirect về `/auth/login`
  - Truy cập `/dashboard` khi đã login → hiển thị bình thường

---

### 3.2 MainLayout Update

**File nguồn:** `src/components/layout/MainLayout.tsx`
**File đích:** `src/components/layout/MainLayout.tsx` (updated)

#### Subtasks:

- [ ] **3.2.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  import { usePathname, useRouter } from "next/navigation";
  
  // ✅ Thay bằng
  import { Link, useLocation, useNavigate } from "react-router-dom";
  ```

- [ ] **3.2.2** Replace hooks
  ```typescript
  // Next.js
  const pathname = usePathname();
  const router = useRouter();
  
  // React Router
  const location = useLocation();
  const navigate = useNavigate();
  ```

- [ ] **3.2.3** Update pathname usage
  ```typescript
  // Next.js
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  
  // React Router (giữ nguyên vì location.pathname có cùng format)
  const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
  ```

- [ ] **3.2.4** Update navigation calls
  ```typescript
  // Next.js
  router.push(addAction.href);
  router.replace("/auth/login");
  
  // React Router
  navigate(addAction.href);
  navigate("/auth/login", { replace: true });
  ```

- [ ] **3.2.5** Update handleLogout
  ```typescript
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/auth/login', { replace: true });
  }, [navigate]);
  ```

- [ ] **3.2.6** Remove `"use client"` directive

- [ ] **3.2.7** Test MainLayout
  - Sidebar navigation hoạt động
  - Bottom navigation (mobile) hoạt động
  - Logout button hoạt động
  - Active states đúng

---

## 4. DASHBOARD PAGE

### 4.1 Dashboard Page

**File nguồn:** `src/app/(protected)/dashboard/page.tsx`
**File đích:** `src/features/dashboard/DashboardPage.tsx`

#### Subtasks:

- [ ] **4.1.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  import { requireUser } from "@/lib/auth";
  import { createClient } from "@/lib/supabase/server";
  ```

- [ ] **4.1.2** Add React imports
  ```typescript
  import { useEffect, useState } from 'react';
  import { Link } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  import { supabase } from '@/lib/supabase/client';
  ```

- [ ] **4.1.3** Convert từ server component sang client component
  ```typescript
  export default function DashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    
    useEffect(() => {
      async function fetchData() {
        if (!user) return;
        
        // Fetch all data từ Supabase
        const [accountsRes, transactionsRes, debtsRes, ...] = await Promise.all([
          supabase.from("accounts").select("*").eq("user_id", user.id),
          // ... các query khác
        ]);
        
        setData({ accounts, transactions, debts, ... });
        setLoading(false);
      }
      
      fetchData();
    }, [user]);
    
    if (loading) {
      return <LoadingSpinner />;
    }
    
    return (
      // JSX giữ nguyên
    );
  }
  ```

- [ ] **4.1.4** Move data fetching logic to custom hook (recommended)
  ```typescript
  // File mới: src/hooks/useDashboardData.ts
  import { useQuery } from '@tanstack/react-query';
  import { supabase } from '@/lib/supabase/client';
  
  export function useDashboardData(userId: string) {
    return useQuery({
      queryKey: ['dashboard', userId],
      queryFn: async () => {
        const [accountsRes, transactionsRes, debtsRes, ordersRes] = await Promise.all([
          supabase.from("accounts").select("*").eq("user_id", userId),
          supabase.from("transactions").select("*").eq("user_id", userId).limit(5),
          supabase.from("debts").select("*").eq("user_id", userId),
          supabase.from("trading_orders").select("*").eq("user_id", userId).limit(5),
        ]);
        
        return {
          accounts: accountsRes.data ?? [],
          transactions: transactionsRes.data ?? [],
          debts: debtsRes.data ?? [],
          orders: ordersRes.data ?? [],
        };
      },
      enabled: !!userId,
    });
  }
  ```

- [ ] **4.1.5** Update component để dùng hook
  ```typescript
  export default function DashboardPage() {
    const { user } = useAuth();
    const { data, isLoading, error } = useDashboardData(user?.id ?? '');
    
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorMessage error={error} />;
    if (!data) return null;
    
    // Render với data
  }
  ```

- [ ] **4.1.6** Keep all UI components unchanged (Card, Badge, Button, v.v.)

- [ ] **4.1.7** Keep all utility functions unchanged (formatNumber, computeOutstanding, v.v.)

- [ ] **4.1.8** Test Dashboard
  - Hiển thị đúng cashflow stats
  - Hiển thị đúng debts stats
  - Hiển thị đúng trading stats
  - Latest transactions/orders hiển thị đúng
  - Reports panel hoạt động

---

## 5. CASHFLOW MODULE

### 5.1 Cashflow Main Page

**File nguồn:** `src/app/(protected)/cashflow/page.tsx`
**File đích:** `src/features/cashflow/CashflowPage.tsx`

#### Subtasks:

- [ ] **5.1.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  import { requireUser } from "@/lib/auth";
  import { createClient } from "@/lib/supabase/server";
  ```

- [ ] **5.1.2** Add React Router imports
  ```typescript
  import { Link, useSearchParams, useNavigate } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  ```

- [ ] **5.1.3** Handle search params
  ```typescript
  // Next.js (server)
  export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
    const range = normalizeCashflowRange((await searchParams)?.range);
  }
  
  // React Router (client)
  export default function CashflowPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const range = normalizeCashflowRange(searchParams.get('range') ?? undefined);
  }
  ```

- [ ] **5.1.4** Convert data fetching to React Query
  ```typescript
  // File mới: src/hooks/useCashflowData.ts
  import { useQuery } from '@tanstack/react-query';
  import { supabase } from '@/lib/supabase/client';
  
  export function useCashflowData(range: string, shift: string, userId: string) {
    const { start, end } = rangeBounds(range, shift);
    
    return useQuery({
      queryKey: ['cashflow', range, shift, userId],
      queryFn: async () => {
        const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
          supabase.from("accounts").select("*").eq("user_id", userId),
          supabase.from("categories").select("*").eq("user_id", userId),
          supabase
            .from("transactions")
            .select("*, category:categories(name), account:accounts(name)")
            .eq("user_id", userId)
            .gte("transaction_time", start.toISOString())
            .lt("transaction_time", end.toISOString()),
        ]);
        
        return {
          accounts: accountsRes.data ?? [],
          categories: categoriesRes.data ?? [],
          transactions: transactionsRes.data ?? [],
        };
      },
      enabled: !!userId,
    });
  }
  ```

- [ ] **5.1.5** Update component
  ```typescript
  export default function CashflowPage() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const range = searchParams.get('range') ?? 'month';
    const shift = searchParams.get('shift') ?? '0';
    
    const { data, isLoading } = useCashflowData(range, shift, user?.id ?? '');
    
    if (isLoading) return <LoadingSpinner />;
    
    return (
      <div>
        <CashflowRangeFilter value={range} onChange={(v) => setSearchParams({ range: v })} />
        <CashflowTransactionList transactions={data.transactions} ... />
      </div>
    );
  }
  ```

- [ ] **5.1.6** Move child components
  - `src/app/(protected)/cashflow/_components/CashflowRangeFilter.tsx` → `src/features/cashflow/components/CashflowRangeFilter.tsx`
  - `src/app/(protected)/cashflow/_components/CashflowTransactionList.tsx` → `src/features/cashflow/components/CashflowTransactionList.tsx`
  - `src/app/(protected)/cashflow/_components/CashflowReport.tsx` → `src/features/cashflow/components/CashflowReport.tsx`
  - `src/app/(protected)/cashflow/_components/CashflowExpenseChart.tsx` → `src/features/cashflow/components/CashflowExpenseChart.tsx`

- [ ] **5.1.7** Remove `"use client"` từ child components

- [ ] **5.1.8** Test Cashflow page
  - Filter range hoạt động
  - Transaction list hiển thị đúng
  - Report component hoạt động

---

### 5.2 New Transaction Page

**File nguồn:** `src/app/(protected)/cashflow/new/page.tsx`
**File đích:** `src/features/cashflow/NewTransactionPage.tsx`

#### Subtasks:

- [ ] **5.2.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import { useRouter } from "next/navigation";
  import { requireUser } from "@/lib/auth";
  ```

- [ ] **5.2.2** Add React Router imports
  ```typescript
  import { useNavigate } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  ```

- [ ] **5.2.3** Update navigation
  ```typescript
  const navigate = useNavigate();
  // Sau khi create thành công
  navigate('/cashflow');
  ```

- [ ] **5.2.4** Convert form submission
  ```typescript
  const createMutation = useCreateTransaction();
  
  const onSubmit = (data: FormData) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        navigate('/cashflow');
      },
    });
  };
  ```

- [ ] **5.2.5** Test create transaction
  - Form validation hoạt động
  - Create thành công → redirect về list
  - Create thất bại → hiển thị error

---

### 5.3 Accounts Page

**File nguồn:** `src/app/(protected)/cashflow/accounts/page.tsx`
**File đích:** `src/features/cashflow/AccountsPage.tsx`

#### Subtasks:

- [ ] **5.3.1** Remove Next.js imports
- [ ] **5.3.2** Add React Router imports
- [ ] **5.3.3** Convert data fetching to React Query
- [ ] **5.3.4** Test accounts CRUD

---

### 5.4 Categories Page

**File nguồn:** `src/app/(protected)/cashflow/categories/page.tsx`
**File đích:** `src/features/cashflow/CategoriesPage.tsx`

#### Subtasks:

- [ ] **5.4.1** Remove Next.js imports
- [ ] **5.4.2** Add React Router imports
- [ ] **5.4.3** Convert data fetching to React Query
- [ ] **5.4.4** Test categories CRUD

---

## 6. DEBTS MODULE

### 6.1 Debts Main Page

**File nguồn:** `src/app/(protected)/debts/page.tsx`
**File đích:** `src/features/debts/DebtsPage.tsx`

#### Subtasks:

- [ ] **6.1.1** Remove Next.js imports
- [ ] **6.1.2** Add React Router imports
- [ ] **6.1.3** Convert data fetching to React Query
- [ ] **6.1.4** Move child components từ `_components/` folder
- [ ] **6.1.5** Test debts list

---

### 6.2 New Debt Page

**File nguồn:** `src/app/(protected)/debts/new/page.tsx`
**File đích:** `src/features/debts/NewDebtPage.tsx`

#### Subtasks:

- [ ] **6.2.1** Remove Next.js imports
- [ ] **6.2.2** Add React Router imports
- [ ] **6.2.3** Update form submission
- [ ] **6.2.4** Test create debt

---

### 6.3 Partners Page

**File nguồn:** `src/app/(protected)/debts/partners/page.tsx`
**File đích:** `src/features/debts/PartnersPage.tsx`

#### Subtasks:

- [ ] **6.3.1** Remove Next.js imports
- [ ] **6.3.2** Add React Router imports
- [ ] **6.3.3** Convert data fetching
- [ ] **6.3.4** Test partners list

---

### 6.4 Debt Detail Page

**File nguồn:** `src/app/(protected)/debts/[id]/page.tsx`
**File đích:** `src/features/debts/DebtDetailPage.tsx`

#### Subtasks:

- [ ] **6.4.1** Remove Next.js imports
- [ ] **6.4.2** Add React Router imports
  ```typescript
  import { useParams } from 'react-router-dom';
  ```
- [ ] **6.4.3** Get debt ID from params
  ```typescript
  const { id } = useParams<{ id: string }>();
  ```
- [ ] **6.4.4** Fetch debt detail by ID
- [ ] **6.4.5** Test debt detail view

---

## 7. TRADING MODULE

### 7.1 Trading Main Page

**File nguồn:** `src/app/(protected)/trading/page.tsx`
**File đích:** `src/features/trading/TradingPage.tsx`

#### Subtasks:

- [ ] **7.1.1** Remove Next.js imports
- [ ] **7.1.2** Add React Router imports
- [ ] **7.1.3** Convert to client component
- [ ] **7.1.4** Test trading overview

---

### 7.2 Trading Dashboard Page

**File nguồn:** `src/app/(protected)/trading/dashboard/page.tsx`
**File đích:** `src/features/trading/TradingDashboardPage.tsx`

#### Subtasks:

- [ ] **7.2.1** Remove Next.js imports
- [ ] **7.2.2** Add React Router imports
- [ ] **7.2.3** Convert data fetching to React Query
- [ ] **7.2.4** Test trading stats

---

### 7.3 Accounts Page

**File nguồn:** `src/app/(protected)/trading/accounts/page.tsx`
**File đích:** `src/features/trading/AccountsPage.tsx`

#### Subtasks:

- [ ] **7.3.1** Remove Next.js imports
- [ ] **7.3.2** Convert data fetching
- [ ] **7.3.3** Test trading accounts

---

### 7.4 Funding Page

**File nguồn:** `src/app/(protected)/trading/funding/page.tsx`
**File đích:** `src/features/trading/FundingPage.tsx`

#### Subtasks:

- [ ] **7.4.1** Remove Next.js imports
- [ ] **7.4.2** Convert data fetching
- [ ] **7.4.3** Test funding history

---

### 7.5 Orders Page

**File nguồn:** `src/app/(protected)/trading/orders/page.tsx`
**File đích:** `src/features/trading/OrdersPage.tsx`

#### Subtasks:

- [ ] **7.5.1** Remove Next.js imports
- [ ] **7.5.2** Convert data fetching
- [ ] **7.5.3** Test orders list

---

### 7.6 Ledger Page

**File nguồn:** `src/app/(protected)/trading/ledger/page.tsx`
**File đích:** `src/features/trading/LedgerPage.tsx`

#### Subtasks:

- [ ] **7.6.1** Remove Next.js imports
- [ ] **7.6.2** Convert data fetching
- [ ] **7.6.3** Test ledger

---

## 8. REPORTS MODULE

### 8.1 Reports Main Page

**File nguồn:** `src/app/(protected)/reports/page.tsx`
**File đích:** `src/features/reports/ReportsPage.tsx`

#### Subtasks:

- [ ] **8.1.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import { requireUser } from "@/lib/auth";
  import { createClient } from "@/lib/supabase/server";
  ```

- [ ] **8.1.2** Add React Router imports
  ```typescript
  import { useSearchParams } from 'react-router-dom';
  import { useAuth } from '@/hooks/useAuth';
  ```

- [ ] **8.1.3** Handle search params
  ```typescript
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get('range') ?? 'month';
  const shift = searchParams.get('shift') ?? '0';
  ```

- [ ] **8.1.4** Convert data fetching to React Query
  ```typescript
  // File mới: src/hooks/useReportsData.ts
  export function useReportsData(range: string, shift: string, userId: string) {
    const { start, end } = rangeBounds(range, shift);
    
    return useQuery({
      queryKey: ['reports', range, shift, userId],
      queryFn: async () => {
        const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
          supabase.from("accounts").select("*").eq("user_id", userId),
          supabase.from("categories").select("*").eq("user_id", userId).eq("type", "expense"),
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .eq("type", "expense")
            .gte("transaction_time", start.toISOString())
            .lt("transaction_time", end.toISOString()),
        ]);
        
        return {
          accounts: accountsRes.data ?? [],
          categories: categoriesRes.data ?? [],
          transactions: transactionsRes.data ?? [],
        };
      },
      enabled: !!userId,
    });
  }
  ```

- [ ] **8.1.5** Move child components
  - `src/app/(protected)/reports/_components/TransactionByCategoryReport.tsx` → `src/features/reports/components/TransactionByCategoryReport.tsx`

- [ ] **8.1.6** Test reports page
  - Pie chart hiển thị đúng
  - Filter range hoạt động
  - Data tính toán đúng

---

## 9. SETTINGS MODULE

### 9.1 Settings Main Page

**File nguồn:** `src/app/(protected)/settings/page.tsx`
**File đích:** `src/features/settings/SettingsPage.tsx`

#### Subtasks:

- [ ] **9.1.1** Remove Next.js imports
  ```typescript
  // ❌ Xóa
  import Link from "next/link";
  ```

- [ ] **9.1.2** Add React Router imports
  ```typescript
  import { Link } from 'react-router-dom';
  ```

- [ ] **9.1.3** Keep component simple (static content)

- [ ] **9.1.4** Test settings navigation

---

### 9.2 Profile Page

**File nguồn:** `src/app/(protected)/settings/profile/page.tsx`
**File đích:** `src/features/settings/ProfilePage.tsx`

#### Subtasks:

- [ ] **9.2.1** Remove Next.js imports
- [ ] **9.2.2** Add React Router imports
- [ ] **9.2.3** Convert form to client-side
- [ ] **9.2.4** Update profile mutation
  ```typescript
  const updateProfileMutation = useUpdateProfile();
  
  const onSubmit = (data: ProfileData) => {
    updateProfileMutation.mutate(data);
  };
  ```
- [ ] **9.2.5** Test profile update

---

### 9.3 Report Dates Page

**File nguồn:** `src/app/(protected)/settings/report-dates/page.tsx`
**File đích:** `src/features/settings/ReportDatesPage.tsx`

#### Subtasks:

- [ ] **9.3.1** Remove Next.js imports
- [ ] **9.3.2** Add React Router imports
- [ ] **9.3.3** Convert data fetching
- [ ] **9.3.4** Test report dates management

---

### 9.4 Telegram Page

**File nguồn:** `src/app/(protected)/settings/telegram/page.tsx`
**File đích:** `src/features/settings/TelegramPage.tsx`

#### Subtasks:

- [ ] **9.4.1** Remove Next.js imports
- [ ] **9.4.2** Add React Router imports
- [ ] **9.4.3** Convert form to client-side
- [ ] **9.4.4** Test telegram integration

---

## 📊 Summary Checklist

### Auth Pages (5 tasks)
- [ ] **Task 1** — 1.1 Login Page (`src/features/auth/LoginPage.tsx`)
- [ ] **Task 2** — 1.2 Register Page (`src/features/auth/RegisterPage.tsx`)
- [ ] **Task 3** — 1.3 Auth Layout (`src/features/auth/AuthLayout.tsx`)
- [ ] **Task 4** — 3.1 ProtectedRoute Component (`src/components/auth/ProtectedRoute.tsx`)
- [ ] **Task 5** — 3.2 MainLayout Update (`src/components/layout/MainLayout.tsx`)

### Public Pages (1 task)
- [ ] **Task 6** — 2.1 Landing Page (`src/features/public/LandingPage.tsx`)

### Dashboard (1 task)
- [ ] **Task 7** — 4.1 Dashboard Page (`src/features/dashboard/DashboardPage.tsx`)

### Cashflow Module (4 tasks)
- [ ] **Task 8** — 5.1 Cashflow Main Page (`src/features/cashflow/CashflowPage.tsx`)
- [ ] **Task 9** — 5.2 New Transaction Page (`src/features/cashflow/NewTransactionPage.tsx`)
- [ ] **Task 10** — 5.3 Accounts Page (`src/features/cashflow/AccountsPage.tsx`)
- [ ] **Task 11** — 5.4 Categories Page (`src/features/cashflow/CategoriesPage.tsx`)

### Debts Module (4 tasks)
- [ ] **Task 12** — 6.1 Debts Main Page (`src/features/debts/DebtsPage.tsx`)
- [ ] **Task 13** — 6.2 New Debt Page (`src/features/debts/NewDebtPage.tsx`)
- [ ] **Task 14** — 6.3 Partners Page (`src/features/debts/PartnersPage.tsx`)
- [ ] **Task 15** — 6.4 Debt Detail Page (`src/features/debts/DebtDetailPage.tsx`)

### Trading Module (6 tasks)
- [ ] **Task 16** — 7.1 Trading Main Page (`src/features/trading/TradingPage.tsx`)
- [ ] **Task 17** — 7.2 Trading Dashboard Page (`src/features/trading/TradingDashboardPage.tsx`)
- [ ] **Task 18** — 7.3 Trading Accounts Page (`src/features/trading/AccountsPage.tsx`)
- [ ] **Task 19** — 7.4 Funding Page (`src/features/trading/FundingPage.tsx`)
- [ ] **Task 20** — 7.5 Orders Page (`src/features/trading/OrdersPage.tsx`)
- [ ] **Task 21** — 7.6 Ledger Page (`src/features/trading/LedgerPage.tsx`)

### Reports Module (1 task)
- [ ] **Task 22** — 8.1 Reports Main Page (`src/features/reports/ReportsPage.tsx`)

### Settings Module (4 tasks)
- [ ] **Task 23** — 9.1 Settings Main Page (`src/features/settings/SettingsPage.tsx`)
- [ ] **Task 24** — 9.2 Profile Page (`src/features/settings/ProfilePage.tsx`)
- [ ] **Task 25** — 9.3 Report Dates Page (`src/features/settings/ReportDatesPage.tsx`)
- [ ] **Task 26** — 9.4 Telegram Page (`src/features/settings/TelegramPage.tsx`)

---

## 📋 Quick Reference

| Task ID | Page | File Path |
|---------|------|-----------|
| Task 1 | Login Page | `src/features/auth/LoginPage.tsx` |
| Task 2 | Register Page | `src/features/auth/RegisterPage.tsx` |
| Task 3 | Auth Layout | `src/features/auth/AuthLayout.tsx` |
| Task 4 | ProtectedRoute | `src/components/auth/ProtectedRoute.tsx` |
| Task 5 | MainLayout | `src/components/layout/MainLayout.tsx` |
| Task 6 | Landing Page | `src/features/public/LandingPage.tsx` |
| Task 7 | Dashboard Page | `src/features/dashboard/DashboardPage.tsx` |
| Task 8 | Cashflow Main | `src/features/cashflow/CashflowPage.tsx` |
| Task 9 | New Transaction | `src/features/cashflow/NewTransactionPage.tsx` |
| Task 10 | Accounts | `src/features/cashflow/AccountsPage.tsx` |
| Task 11 | Categories | `src/features/cashflow/CategoriesPage.tsx` |
| Task 12 | Debts Main | `src/features/debts/DebtsPage.tsx` |
| Task 13 | New Debt | `src/features/debts/NewDebtPage.tsx` |
| Task 14 | Partners | `src/features/debts/PartnersPage.tsx` |
| Task 15 | Debt Detail | `src/features/debts/DebtDetailPage.tsx` |
| Task 16 | Trading Main | `src/features/trading/TradingPage.tsx` |
| Task 17 | Trading Dashboard | `src/features/trading/TradingDashboardPage.tsx` |
| Task 18 | Trading Accounts | `src/features/trading/AccountsPage.tsx` |
| Task 19 | Funding | `src/features/trading/FundingPage.tsx` |
| Task 20 | Orders | `src/features/trading/OrdersPage.tsx` |
| Task 21 | Ledger | `src/features/trading/LedgerPage.tsx` |
| Task 22 | Reports | `src/features/reports/ReportsPage.tsx` |
| Task 23 | Settings Main | `src/features/settings/SettingsPage.tsx` |
| Task 24 | Profile | `src/features/settings/ProfilePage.tsx` |
| Task 25 | Report Dates | `src/features/settings/ReportDatesPage.tsx` |
| Task 26 | Telegram | `src/features/settings/TelegramPage.tsx` |

---

## 🔧 Common Patterns

### Pattern 1: Remove Next.js imports
```typescript
// ❌ Before
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { redirect } from "next/navigation";

// ✅ After
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Navigate } from "react-router-dom";
```

### Pattern 2: Convert server component to client component
```typescript
// ❌ Before (Next.js Server Component)
export default async function Page() {
  const user = await requireUser();
  const data = await fetchData();
  return <div>{data}</div>;
}

// ✅ After (React Client Component)
export default function Page() {
  const { user } = useAuth();
  const { data, isLoading } = useDataQuery(user?.id);
  
  if (isLoading) return <LoadingSpinner />;
  return <div>{data}</div>;
}
```

### Pattern 3: Handle search params
```typescript
// ❌ Before (Next.js)
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const range = (await searchParams).range ?? 'default';
}

// ✅ After (React Router)
export default function Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get('range') ?? 'default';
  
  const updateRange = (newRange: string) => {
    setSearchParams({ range: newRange });
  };
}
```

### Pattern 4: Dynamic route params
```typescript
// ❌ Before (Next.js)
export default async function Page({ params }: { params: { id: string } }) {
  const id = (await params).id;
}

// ✅ After (React Router)
export default function Page() {
  const { id } = useParams<{ id: string }>();
}
```

---

**Generated:** 2026-03-01
**Total Subtasks:** ~78 tasks across 9 modules
