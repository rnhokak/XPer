

````md
# AI UI iOS GUIDE – Mobile & PWA for iPhone

This guide defines how ALL UI for this project should be designed and implemented for **iOS-first**, **PWA-ready**, and **mobile-friendly** behavior.

Any AI coding assistant MUST follow these rules when generating UI, layouts, navigation, and PWA-related code.

---

## 1. General Principles

1. **iOS-first, mobile-first**:
   - Design for iPhone (small screens) FIRST, then scale up to tablet/desktop.
   - Default layout should look good on a ~390×844 screen (iPhone 12/13/14).

2. **Touch-friendly**:
   - Minimum touch target: **44×44 px**.
   - Use enough spacing between buttons and interactive elements (`gap-3`, `gap-4`).

3. **Readable text**:
   - Default body text: `text-sm` or `text-base`.
   - Avoid extra-small fonts for critical info.

4. **Clean, flat, slightly rounded design**:
   - Use Tailwind with:
     - Rounded corners: `rounded-lg`, `rounded-xl`.
     - Soft shadows when needed: `shadow-sm`, `shadow-md`.
   - Avoid overly heavy borders and clutter.

---

## 2. Page Layout Guidelines

### 2.1. Container

For most main screens (dashboard, cashflow, trading, partners, etc.):

```tsx
<div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
  {/* content */}
</div>
````

Rules:

* Use `max-w-md` or `max-w-lg` for center column on mobile.
* Outer padding at least `p-4` on mobile.
* Use `gap-3` / `gap-4` between sections.

### 2.2. Topbar / Header

* For protected pages, prefer a **simple topbar** with:

  * Screen title
  * Optional back button
  * Small action(s) (e.g. “+” for add).

Example:

```tsx
<div className="flex items-center justify-between pb-2">
  <h1 className="text-lg font-semibold">Cashflow</h1>
  <button className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-slate-950">
    + Add
  </button>
</div>
```

### 2.3. Bottom spacing & safe area

* Always leave room at the bottom for safe area / gesture bar on iPhone:

  * Use `pb-8` or `pb-12` on main wrappers.
* If you pin primary buttons at bottom, consider:

```tsx
<div className="sticky bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-md p-3">
  {/* primary button */}
</div>
```

---

## 3. Forms & Inputs UX

### 3.1. General rules

* Use **vertical forms**, one column.
* Group related fields with spacing and simple headings.
* Primary action button should be clearly visible and easy to tap.

Example pattern:

```tsx
<form className="space-y-4">
  <div className="space-y-1">
    <label className="text-xs text-slate-300">Amount</label>
    <input
      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-400"
    />
  </div>

  <div className="flex gap-2">
    {/* two small inputs side-by-side */}
  </div>

  <button className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950">
    Save
  </button>
</form>
```

### 3.2. iOS-friendly controls

* For selects & pickers:

  * Use shadcn/ui `Select`, `Popover`, `Dialog`, or a custom bottom sheet.
* For dates:

  * Use mobile-friendly date pickers; if using HTML5:

    * `<input type="date" />` is acceptable but consider wrapping with nicer UI.

---

## 4. Navigation Patterns

### 4.1. Use client-side navigation

* Always prefer **client-side navigation** using Next.js:

```tsx
"use client";
import Link from "next/link";

<Link href="/cashflow">Cashflow</Link>
```

* Do NOT use full reload when moving inside the app:

  * Avoid `<a href="https://domain.com/page">` for internal routes.
  * Use `<Link href="/page">` or `router.push("/page")`.

### 4.2. Avoid popping out of PWA

To keep the PWA feeling “like an app” on iOS:

* Do NOT change origin (domain) or subdomain for internal navigation.
* Avoid `target="_blank"` for internal links.
* External links (docs, blog, etc.) may use `target="_blank"`.

---

## 5. iOS PWA Meta & Manifest

Any AI adding or editing head tags related to PWA MUST respect these rules:

### 5.1. PWA manifest

Ensure there is a manifest at `/manifest.json` with:

```json
{
  "name": "xP App",
  "short_name": "xP",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#00a65a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

And include in `layout`:

```tsx
<link rel="manifest" href="/manifest.json" />
```

### 5.2. iOS web app meta

Always include:

```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="xP" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

---

## 6. PWA Behavior on iOS (Navigation & Standalone)

To reduce the chance of iOS showing URL bar / back bar:

1. **Keep navigation SPA-style**:

   * Use client components when using `<Link>` heavily.
   * Avoid using `redirect()` for simple moves that can be done from client.

2. **When creating navigation-heavy pages**:

   * Wrap them as Client Components in `src/features/**`.
   * Let server `page.tsx` only fetch data and render the client page component.

Pattern:

```tsx
// app/(protected)/partners/page.tsx – Server
import { PartnersPageClient } from "@/features/partners/PartnersPageClient";

export default async function PartnersPage() {
  // fetch data with Supabase
  return <PartnersPageClient initialData={...} />;
}
```

```tsx
// features/partners/PartnersPageClient.tsx – Client
"use client";

import Link from "next/link";

export function PartnersPageClient({ initialData }: { initialData: any[] }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      {/* UI with <Link>, buttons, filters */}
    </div>
  );
}
```

---

## 7. Buttons & Primary Actions

* Always highlight primary actions with:

  * Solid, high-contrast color (e.g., `bg-emerald-500 text-slate-950`).
* Secondary actions:

  * Outlined or ghost buttons (border only, or low-intensity background).

Examples:

```tsx
<button className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950">
  Save
</button>

<button className="w-full rounded-lg border border-slate-600 py-2 text-sm text-slate-100">
  Cancel
</button>
```

---

## 8. Lists & Tables on Mobile

* Avoid heavy `<table>` on narrow screens.
* Prefer stacked card/list layouts on small devices.

Example (transactions list):

```tsx
<ul className="space-y-2">
  {items.map((tx) => (
    <li
      key={tx.id}
      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
    >
      <div className="space-y-0.5">
        <div className="text-xs text-slate-400">{tx.date}</div>
        <div className="text-sm font-medium">{tx.title}</div>
      </div>
      <div className="text-right text-sm font-semibold text-emerald-400">
        {tx.amountFormatted}
      </div>
    </li>
  ))}
</ul>
```

On larger screens, tables are acceptable, but mobile should remain clean.

---

## 9. Dialogs, Sheets, and Modals

When using shadcn/ui dialogs:

* On mobile, treat dialogs like **sheets** or **full-screen modals** where appropriate.
* Ensure content inside dialogs is scrollable with appropriate padding.

Example:

```tsx
<DialogContent className="max-w-md w-full rounded-t-2xl sm:rounded-2xl px-4 py-4">
  {/* form or content */}
</DialogContent>
```

---

## 10. Performance & Perceived Smoothness

* Avoid heavy animations; keep transitions subtle.
* Use `transition` classes for hover/tap feedback, but not overdone.

Example:

```tsx
<button className="transition active:scale-[0.98]">
  ...
</button>
```

---

## 11. When generating UI code

Whenever you generate UI for this project, you MUST:

1. Design layouts using the mobile-first container patterns above.
2. Ensure touch targets and spacing are comfortable on iPhone.
3. Use client-side navigation where appropriate to preserve PWA app-like behavior.
4. Respect PWA/iOS meta and manifest rules when editing the `<head>`.
5. Prefer simple, clean, and readable designs over overly complex grids/tables.

---

End of AI UI iOS GUIDE.

