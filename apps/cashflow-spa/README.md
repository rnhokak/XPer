# Cashflow SPA

Vite + React + TypeScript SPA hosted under `/app/cashflow` on the main Next.js domain.

## Environment

Copy `.env.example` to `.env`:

- `VITE_BASE_PATH=/app/cashflow`
- `VITE_API_BASE_URL` (optional) proxy target for dev, set to the Next.js dev URL

## Local dev

Run Next.js and the SPA in parallel:

```bash
npm run dev
npm run cashflow:dev
```

If your Next.js dev server is not on `http://localhost:3000`, set `VITE_API_BASE_URL` accordingly.

## Build + host

Builds run through the root pipeline:

```bash
npm run build
```

This builds the SPA into `apps/cashflow-spa/dist`, then copies it to `public/app/cashflow` so Next.js can serve it.

## Routing

- `/app/cashflow` -> list screen
- `/app/cashflow/new` -> add transaction

Next.js rewrites all non-asset paths under `/app/cashflow` to `/app/cashflow/index.html`.

## Expanding to other modules

Add a new Vite SPA folder (e.g. `apps/trading-spa`) and mirror the build + copy + rewrite flow for `/app/trading` or `/app/partners`.
