
````md
# AI COMMON GUIDE – PersonalX Project

This file defines COMMON RULES for any AI coding assistant (Copilot, Codex, GPT, Continue, etc.) working in this repository.

You MUST follow these rules unless the user explicitly overrides them.

---

## 1. Architecture Overview

- This is a **Next.js App Router + TypeScript** project.
- We use:
  - `src/app` for **route entrypoints** (mostly Server Components).
  - `src/features` for **feature/domain components & logic** (mostly Client Components).
  - `src/lib` for **shared logic** (supabase, helpers, utils).
  - `components/ui` for shadcn UI building blocks.

You MUST keep this structure and extend it, not replace it.

Example:

```txt
src/
  app/
    (public)/
    (auth)/
    (protected)/
      dashboard/
      cashflow/
      trading/
      partners/
      settings/
  features/
    auth/
    layout/
    cashflow/
    trading/
    debts/
    partners/
    profile/
    common/
  lib/
    supabase/
    utils/
  components/
    ui/
````

---

## 2. Server vs Client Components (STRICT RULE)

You MUST always separate server logic and client logic.

### 2.1. Server Components

* All `page.tsx` and `layout.tsx` under `src/app/**` are **Server Components by default**.
* They are responsible for:

  * Auth checks (using Supabase server client).
  * Data fetching (from Supabase/Postgres).
  * Redirects (`redirect("/auth/login")`, `redirect("/dashboard")`, ...).
  * Composing **feature-level Client Components**.

**NEVER** put React hooks (`useState`, `useEffect`, `useRouter`) directly in server `page.tsx` or `layout.tsx`.

Pattern:

```tsx
// app/(protected)/cashflow/page.tsx (Server)
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CashflowPageClient } from "@/features/cashflow/CashflowPageClient";

export default async function CashflowPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id);

  return (
    <CashflowPageClient
      userId={user.id}
      initialTransactions={transactions ?? []}
    />
  );
}
```

### 2.2. Client Components

Any component that:

* Uses hooks (`useState`, `useEffect`, `useRouter`, `useForm`, etc.).
* Handles user events (onClick, onSubmit, onChange).
* Uses browser APIs (window, document, localStorage).
* Uses React Hook Form, shadcn Dialog, Drawer, etc.

→ MUST be a **Client Component** with `"use client"` at the top, and placed under `src/features/**`.

Pattern:

```tsx
// src/features/cashflow/CashflowPageClient.tsx
"use client";

import { CashflowQuickAddForm } from "./CashflowQuickAddForm";
import { TransactionsList } from "./TransactionsList";

export function CashflowPageClient(props: { userId: string; initialTransactions: any[]; }) {
  // client-side state, filters, etc.
  return (
    <div className="flex flex-col gap-4">
      <CashflowQuickAddForm userId={props.userId} />
      <TransactionsList initialData={props.initialTransactions} />
    </div>
  );
}
```

---

## 3. Feature-based file splitting

You MUST organize code by **feature/domain**, not by type only.

Examples:

```txt
src/features/cashflow/
  CashflowPageClient.tsx
  CashflowQuickAddForm.tsx
  TransactionsList.tsx
  AccountsPageClient.tsx
  AccountsTable.tsx
  AccountFormDialog.tsx
  CategoriesPageClient.tsx
  CategoriesTree.tsx
  CategoryFormDialog.tsx

src/features/trading/
  OrdersPageClient.tsx
  OrdersTable.tsx
  OrderFormDialog.tsx
  FundingPageClient.tsx
  FundingTable.tsx
  FundingFormDialog.tsx

src/features/partners/
  PartnersPageClient.tsx
  PartnersTable.tsx
  PartnerDetailPageClient.tsx
  PartnerTransactionsList.tsx
  PartnerTransactionFormDialog.tsx
  PartnerForm.tsx
```

**RULES:**

* Do NOT put large UI blocks directly inside `page.tsx`.
* If a component or UI block has its own responsibility (form, table, detail view, list, dialog), create a separate file for it in the appropriate `src/features/<feature>` directory.
* Shared generic UI goes to `src/features/common` or `components/ui`.

---

## 4. iOS-first / Mobile-first UI design (MUST FOLLOW)

All UI you design MUST be optimized for **iOS / mobile** first, then scale up to desktop.

### 4.1. General iOS design guidelines

* **Touch target size**: at least 44x44 px (Apple HIG).
* Use **bottom spacing** and consider **safe area insets** (avoid controls touching screen edges).
* Use **rounded corners** (md-xl), soft shadows, readable contrasts.
* Avoid tiny text; default text at least `text-sm` / `text-base` for mobile.

### 4.2. Layout rules

* Use a **single column layout** by default (`max-w-md` or `max-w-lg` on mobile).
* Use `gap-3` / `gap-4` between sections for breathing room.
* Use consistent padding: e.g. `p-4` on mobile pages.

Example:

```tsx
<div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
  {/* content */}
</div>
```

### 4.3. Navigation

* For mobile main navigation, prefer:

  * Topbar with title + small actions, **or**
  * Bottom navigation tabs.
* Avoid too many links crowded on top. Use clear primary button for main action (e.g. "Add transaction", "New order").

### 4.4. Forms UX

* Group related fields.
* Use clear labels and placeholders.
* Primary action button pinned at bottom or clearly visible.
* Use shadcn/ui components that look good on iOS (Buttons, Inputs, Selects, Dialogs, Sheets).

---

## 5. Supabase usage

* In **Server Components**: use `createSupabaseServerClient` from `src/lib/supabase/server.ts`.
* In **Client Components**: use `createSupabaseBrowserClient` from `src/lib/supabase/client.ts`.
* Always filter data by `user_id` where applicable (multi-tenant per user).

---

## 6. Coding style

* Always use **TypeScript**.
* Use Zod + React Hook Form for forms.
* Use shadcn/ui for common UI (Button, Input, Select, Dialog, Sheet, Table, Card).
* Keep components small and focused.

---

## 7. When generating new code

When the user asks you to implement a feature:

1. **Identify feature/domain** (auth, cashflow, trading, partners, debts, profile, settings, etc.).
2. Add/modify:

   * `page.tsx` under `src/app/(protected)/(or other)/...` as a **Server Component**.
   * Corresponding `*PageClient.tsx` under `src/features/<feature>` as a **Client Component**.
3. Split UI into smaller components in `src/features/<feature>` if necessary.
4. Design UI with **iOS-first** approach:

   * Mobile-friendly layout.
   * Proper spacing, readable text, clear primary actions.
5. DO NOT ignore this guide unless the user explicitly says: “ignore AI_COMMON_GUIDE”.

---

End of AI COMMON GUIDE.
