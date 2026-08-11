# XPer Monorepo

A monorepo containing the XPer Finance application with a Next.js backend and React + Vite frontend.

## Structure

```
XPer-Next/
├── apps/
│   ├── web/              # Next.js (Backend/API)
│   └── client/           # React + Vite (Frontend SPA)
├── packages/             # Shared packages (optional)
├── supabase/             # Supabase configuration
└── docs/                 # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Run both apps (client + web)
pnpm dev

# Run only the web (Next.js API)
pnpm run dev:web

# Run only the client (React + Vite)
pnpm run dev:client
```

### Build

```bash
# Build all apps
pnpm build

# Build only the client
pnpm run build:client

# Build only the web
pnpm run build:web
```

## Apps

### Client (React + Vite)

- **Port:** 3001
- **Directory:** `apps/client`
- **Description:** React SPA with Vite for fast development and HMR

### Web (Next.js API)

- **Port:** 3005
- **Directory:** `apps/web`
- **Description:** Next.js server serving as API backend

## Environment Variables

### Client (.env)

```
VITE_API_URL=http://localhost:3005/api
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Web (.env)

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3005
CORS_ORIGIN=http://localhost:3001
```

## Architecture

- **Frontend (Client):** React SPA using Vite, React Router for navigation, and TanStack Query for data fetching
- **Backend (Web):** Next.js API routes serving as a backend for the client app
- **Authentication:** Supabase auth with client-side session management
- **CORS:** Configured to allow requests from the client app
