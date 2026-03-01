# Kế hoạch Migration: Next.js + React (Vite) Monorepo Architecture

**Mục tiêu:** Tách frontend thành React SPA (Vite) như một sub-project, trong khi Next.js vẫn đóng vai trò backend server.

**Lý do:**
- Frontend: Build nhanh hơn với Vite, HMR tốt hơn, giảm bundle size
- Backend: Next.js vẫn giữ vai trò API server, SSR (nếu cần), và proxy
- Deploy linh hoạt: Có thể deploy riêng hoặc cùng nhau
- Development experience tốt hơn cho team frontend

---

## 🏗️ Kiến trúc mới

```
XPer-Next/
├── apps/
│   ├── web/              # Next.js (Backend/API)
│   └── client/           # React + Vite (Frontend SPA)
├── packages/             # Shared packages (optional)
│   └── ui/               # Shared UI components (optional)
├── supabase/             # Supabase configuration
└── docs/                 # Documentation
```

---

## 📋 Tổng quan các hạng mục

### 1. Project Setup & Monorepo Configuration
### 2. Frontend (React + Vite) Setup
### 3. Backend (Next.js) API Configuration
### 4. Routing (App Router → React Router)
### 5. Authentication (SSR → Client-side + Next.js API)
### 6. Components & Pages Migration
### 7. State Management
### 8. API Communication (Client ↔ Next.js API ↔ Supabase)
### 9. Build & Deploy

---

## 📝 Chi tiết các task

---

## 1. PROJECT SETUP & MONOREPO CONFIGURATION

### Task 1.1: Tái cấu trúc folder structure

**Option A: Manual Setup (Recommended for simplicity)**
```bash
# Trong project hiện tại
mkdir -p apps/client
# Di chuyển src hiện tại vào apps/client sau khi setup
```

**Option B: Turborepo (Recommended for scalability)**
```bash
npx create-turbo@latest xper-monorepo
# Chọn React template
```

### Task 1.2: Cấu hình workspace với pnpm (Recommended)

**File:** `pnpm-workspace.yaml` (root)
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Task 1.3: Update root package.json

**File:** `package.json` (root)
```json
{
  "name": "xper-monorepo",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:client\"",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:client": "npm run dev --workspace=apps/client",
    "build": "npm run build --workspace=apps/client && npm run build --workspace=apps/web",
    "build:client": "npm run build --workspace=apps/client",
    "build:web": "npm run build --workspace=apps/web"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

---

## 2. FRONTEND (REACT + VITE) SETUP

### Task 2.1: Tạo React Vite sub-project

```bash
# Tạo trong apps/client
npm create vite@latest apps/client -- --template react-ts
```

### Task 2.2: Cài đặt dependencies cho client

```bash
cd apps/client
npm install

# Core dependencies
npm install react-router-dom @tanstack/react-query @tanstack/react-query-devtools
npm install @supabase/supabase-js
npm install zustand
npm install react-hook-form @hookform/resolvers zod
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-slot
npm install lucide-react
npm install axios

# Dev dependencies
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/node
npm install -D @vitejs/plugin-react
npx tailwindcss init -p
```

### Task 2.3: Cấu hình Vite

**File:** `apps/client/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

### Task 2.4: Cấu hình TypeScript

**File:** `apps/client/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Task 2.5: Environment Variables (Client)

**File:** `apps/client/.env`
```
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**File:** `apps/client/.env.example`
```
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## 3. BACKEND (NEXT.JS) API CONFIGURATION

### Task 3.1: Tái cấu trúc Next.js làm API server

**File:** `apps/web/.env`
```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_API_URL=http://localhost:3000/api
CORS_ORIGIN=http://localhost:3001
```

### Task 3.2: Cấu hình CORS middleware

**File:** `apps/web/middleware.ts`
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Allow requests from client app
  const allowedOrigins = [
    'http://localhost:3001',
    process.env.CORS_ORIGIN,
  ]
  
  const origin = request.headers.get('origin')
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200 })
  }
  
  return response
}

export const config = {
  matcher: '/api/:path*',
}
```

### Task 3.3: Update Next.js config

**File:** `apps/web/next.config.mjs`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only mode
  output: 'standalone',
  
  // CORS configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: 'http://localhost:3001' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

export default nextConfig
```

### Task 3.4: Tổ chức lại API routes

**Cấu trúc mới:**
```
apps/web/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   │   └── route.ts
│   │       │   ├── register/
│   │       │   │   └── route.ts
│   │       │   ├── logout/
│   │       │   │   └── route.ts
│   │       │   └── session/
│   │       │       └── route.ts
│   │       ├── cashflow/
│   │       │   ├── transactions/
│   │       │   │   └── route.ts
│   │       │   ├── accounts/
│   │       │   └── categories/
│   │       ├── debts/
│   │       ├── trading/
│   │       └── reports/
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── server.ts
│   │   ├── auth.ts
│   │   └── api/
│   └── types/
```

---

## 4. ROUTING (App Router → React Router)

### Task 4.1: Cài đặt React Router

```bash
cd apps/client
npm install react-router-dom
```

### Task 4.2: Tạo router configuration

**File:** `apps/client/src/router/index.tsx`
```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '../App'
import LandingPage from '../features/public/LandingPage'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import ProtectedRoute from '../components/auth/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/register', element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'cashflow/*', element: <CashflowModule /> },
          { path: 'debts/*', element: <DebtsModule /> },
          { path: 'trading/*', element: <TradingModule /> },
          { path: 'reports/*', element: <ReportsModule /> },
          { path: 'settings/*', element: <SettingsModule /> },
        ],
      },
    ],
  },
])
```

### Task 4.3: Map routes

| Next.js Route (Old) | React Router Path | API Endpoint |
|---------------------|-------------------|--------------|
| `src/app/(public)/page.tsx` | `/` | - |
| `src/app/(auth)/login/page.tsx` | `/auth/login` | `POST /api/auth/login` |
| `src/app/(auth)/register/page.tsx` | `/auth/register` | `POST /api/auth/register` |
| `src/app/(protected)/dashboard/page.tsx` | `/dashboard` | `GET /api/dashboard` |
| `src/app/(protected)/cashflow/page.tsx` | `/cashflow` | `GET /api/cashflow/transactions` |
| `src/app/(protected)/cashflow/new/page.tsx` | `/cashflow/new` | `POST /api/cashflow/transactions` |
| `src/app/(protected)/cashflow/accounts/page.tsx` | `/cashflow/accounts` | `GET /api/cashflow/accounts` |
| `src/app/(protected)/debts/page.tsx` | `/debts` | `GET /api/debts` |
| `src/app/(protected)/trading/dashboard/page.tsx` | `/trading/dashboard` | `GET /api/trading/dashboard` |
| `src/app/(protected)/reports/page.tsx` | `/reports` | `GET /api/reports` |
| `src/app/(protected)/settings/page.tsx` | `/settings` | `GET/PUT /api/settings` |

---

## 5. AUTHENTICATION (Client-side + Next.js API)

### Task 5.1: Tạo API client cho client app

**File:** `apps/client/src/lib/api/client.ts`
```typescript
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('auth_token')
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  }
)
```

### Task 5.2: Tạo Supabase client (cho direct client calls nếu cần)

**File:** `apps/client/src/lib/supabase/client.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Task 5.3: Tạo Auth Hook

**File:** `apps/client/src/hooks/useAuth.ts`
```typescript
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { apiClient } from '@/lib/api/client'

interface AuthResponse {
  user: User
  token?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get session from Next.js API
    apiClient.get('/auth/session')
      .then(({ data }) => {
        setUser(data.user)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password })
    if (data.token) {
      localStorage.setItem('auth_token', data.token)
    }
    return data
  }

  const signUp = async (email: string, password: string) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', { email, password })
    return data
  }

  const signOut = async () => {
    await apiClient.post('/auth/logout')
    localStorage.removeItem('auth_token')
    setUser(null)
  }

  return { user, loading, signIn, signUp, signOut }
}
```

### Task 5.4: Tạo Protected Route Component

**File:** `apps/client/src/components/auth/ProtectedRoute.tsx`
```typescript
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import MainLayout from '@/components/layout/MainLayout'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return (
    <MainLayout userEmail={user.email} userDisplayName={null}>
      <Outlet />
    </MainLayout>
  )
}
```

### Task 5.5: Next.js API Routes cho Auth

**File:** `apps/web/src/app/api/auth/login/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({
    user: data.user,
    token: data.session?.access_token,
  })
}
```

**File:** `apps/web/src/app/api/auth/session/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user })
}
```

---

## 6. COMPONENTS & PAGES MIGRATION

### Task 6.1: Di chuyển components

**Cấu trúc folder mới:**
```
apps/client/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx
│   │   │   └── Header.tsx
│   │   ├── providers/
│   │   │   ├── QueryProvider.tsx
│   │   │   └── MoneyVisibilityProvider.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       └── ...
```

### Task 6.2: Convert Next.js components → React

#### 6.2.1: Remove `"use client"` directives
- Tất cả `"use client"` không cần trong Vite/React SPA

#### 6.2.2: Replace Next.js imports
```typescript
// ❌ Next.js
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { redirect } from 'next/navigation'

// ✅ React Router
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
```

#### 6.2.3: Update hooks usage
```typescript
// Next.js
const router = useRouter()
const pathname = usePathname()

router.push('/dashboard')
router.replace('/auth/login')

// React Router
const navigate = useNavigate()
const location = useLocation()

navigate('/dashboard')
navigate('/auth/login', { replace: true })
```

### Task 6.3: Update MainLayout

**File:** `apps/client/src/components/layout/MainLayout.tsx`
```typescript
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface MainLayoutProps {
  children: React.ReactNode
  userEmail: string
  userDisplayName: string | null
}

export default function MainLayout({ children, userEmail, userDisplayName }: MainLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with React Router Links */}
      <header>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/cashflow">Cashflow</Link>
        {/* ... */}
      </header>
      
      <main>{children}</main>
    </div>
  )
}
```

---

## 7. STATE MANAGEMENT

### Task 7.1: Giữ nguyên Zustand stores

**Files:**
- `apps/client/src/store/ui.ts`
- `apps/client/src/store/money-visibility.ts`
- `apps/client/src/store/notifications.ts`

Zustand hoạt động độc lập với framework, không cần thay đổi.

### Task 7.2: Update React Query Provider

**File:** `apps/client/src/components/providers/QueryProvider.tsx`
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### Task 7.3: Update App.tsx

**File:** `apps/client/src/App.tsx`
```typescript
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { QueryProvider } from './components/providers/QueryProvider'
import { MoneyVisibilityProvider } from './components/providers/MoneyVisibilityProvider'

function App() {
  return (
    <QueryProvider>
      <MoneyVisibilityProvider>
        <RouterProvider router={router} />
      </MoneyVisibilityProvider>
    </QueryProvider>
  )
}

export default App
```

---

## 8. API COMMUNICATION

### Task 8.1: Tạo API client functions

**File:** `apps/client/src/lib/api/cashflow.ts`
```typescript
import { apiClient } from './client'

export interface TransactionFilters {
  accountId?: string
  startDate?: string
  endDate?: string
  type?: 'income' | 'expense'
}

export async function getTransactions(filters?: TransactionFilters) {
  const { data } = await apiClient.get('/cashflow/transactions', { params: filters })
  return data
}

export async function createTransaction(transaction: {
  amount: number
  type: 'income' | 'expense'
  accountId: string
  categoryId: string
  date: string
  description?: string
}) {
  const { data } = await apiClient.post('/cashflow/transactions', transaction)
  return data
}

export async function updateTransaction(id: string, transaction: Partial<typeof createTransaction>) {
  const { data } = await apiClient.put(`/cashflow/transactions/${id}`, transaction)
  return data
}

export async function deleteTransaction(id: string) {
  const { data } = await apiClient.delete(`/cashflow/transactions/${id}`)
  return data
}
```

### Task 8.2: Update React Query hooks

**File:** `apps/client/src/hooks/useCashflowTransactions.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as cashflowApi from '@/lib/api/cashflow'

export function useCashflowTransactions(filters?: cashflowApi.TransactionFilters) {
  return useQuery({
    queryKey: ['cashflow', 'transactions', filters],
    queryFn: () => cashflowApi.getTransactions(filters),
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cashflowApi.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow', 'transactions'] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof cashflowApi.createTransaction> }) =>
      cashflowApi.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow', 'transactions'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cashflowApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow', 'transactions'] })
    },
  })
}
```

### Task 8.3: Next.js API Routes

**File:** `apps/web/src/app/api/cashflow/transactions/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireUser(request)
    
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('cashflow_transactions')
      .select('*, accounts(name), categories(name)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (accountId) query = query.eq('account_id', accountId)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await request.json()

    const { data, error } = await supabase
      .from('cashflow_transactions')
      .insert({ ...body, user_id: user.id })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 400 })
  }
}
```

---

## 9. BUILD & DEPLOY

### Task 9.1: Update package.json scripts

**File:** `apps/client/package.json`
```json
{
  "name": "@xper/client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

**File:** `apps/web/package.json`
```json
{
  "name": "@xper/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### Task 9.2: Build configuration

```bash
# Development (run both apps)
npm run dev

# Build client only
npm run build:client

# Build web only
npm run build:web

# Build all
npm run build
```

### Task 9.3: Deploy options

#### Option A: Deploy together (Vercel)
- Build cả client và web
- Client build → static files serve bởi Next.js
- Web build → Next.js server

**File:** `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

#### Option B: Deploy separately
- **Client:** Netlify, Vercel, hoặc static hosting
- **Web:** Vercel, Railway, Render

**Client deploy (Netlify):**
- Build command: `npm run build`
- Publish directory: `apps/client/dist`

**Web deploy (Vercel):**
- Root directory: `apps/web`
- Build command: `npm run build`

#### Option C: Docker deployment
```dockerfile
# Multi-stage build
FROM node:20-alpine AS base

# Client build
FROM base AS client-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json ./apps/client/
RUN npm install -g pnpm && pnpm install
COPY apps/client ./apps/client
RUN pnpm run build:client

# Web build
FROM base AS web-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN npm install -g pnpm && pnpm install
COPY apps/web ./apps/web
RUN pnpm run build:web

# Production
FROM base AS production
WORKDIR /app
COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=client-builder /app/apps/client/dist ./public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### Task 9.4: Environment configuration

**Production environment variables:**

**Client:**
```
VITE_API_URL=https://api.yourdomain.com/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

**Web:**
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
CORS_ORIGIN=https://yourdomain.com
```

---

## 📅 Migration Timeline

### Phase 1: Setup & Configuration (2-3 days)
- [ ] Task 1.1-1.3: Monorepo setup
- [ ] Task 2.1-2.5: Client (React + Vite) setup
- [ ] Task 3.1-3.4: Web (Next.js API) setup
- [ ] Task 4.1-4.2: Router configuration

### Phase 2: Core Infrastructure (2-3 days)
- [ ] Task 5.1-5.4: Authentication (client hook + API routes)
- [ ] Task 6.1-6.2: Component migration
- [ ] Task 7.1-7.3: State management

### Phase 3: API Development (3-4 days)
- [ ] Task 8.1-8.2: Client API functions + hooks
- [ ] Task 8.3: Next.js API routes
- [ ] Test API communication

### Phase 4: Pages Migration (3-5 days)
- [ ] Convert LandingPage
- [ ] Convert auth pages (Login, Register)
- [ ] Convert Dashboard
- [ ] Convert Cashflow module
- [ ] Convert Debts module
- [ ] Convert Trading module
- [ ] Convert Reports module
- [ ] Convert Settings module

### Phase 5: Testing & Deploy (2-3 days)
- [ ] Task 9.1-9.4: Build & Deploy configuration
- [ ] Test authentication flow end-to-end
- [ ] Test all routes
- [ ] Test responsive design
- [ ] Performance optimization
- [ ] Security review

**Tổng thời gian ước tính:** 12-18 ngày

---

## ⚠️ Lưu ý quan trọng

### Không cần migrate:
1. ❌ `src/app/layout.tsx` - Next.js root layout (giữ cho API server)
2. ❌ `src/app/(protected)/layout.tsx` - Server layout
3. ❌ `src/app/(public)/layout.tsx` - Public layout

### Cần giữ lại trong Next.js (web):
1. ✅ `middleware.ts` - CORS middleware (updated)
2. ✅ `src/app/api/*` - API routes (giữ nguyên hoặc refactor)
3. ✅ `src/lib/auth.ts` - Server-side auth functions
4. ✅ `src/lib/supabase/server.ts` - Server client
5. ✅ `next.config.mjs` - Next.js config

### Cần chuyển sang React client:
1. ⚠️ Tất cả UI components (`src/components/ui/*`)
2. ⚠️ Layout components (`MainLayout`, `Header`)
3. ⚠️ Tất cả pages (`src/app/(*)/`)
4. ⚠️ Client hooks
5. ⚠️ Zustand stores
6. ⚠️ React Query providers

### Giữ nguyên (có thể share):
1. ✅ Utility functions (`src/lib/utils.ts`)
2. ✅ Validation schemas (`src/lib/validation/*`)
3. ✅ TypeScript types (`src/types/*`)
4. ✅ Feature components (business logic)

---

## 📁 Folder Structure Sau Migration

```
XPer-Next/
├── apps/
│   ├── client/                 # React + Vite (Frontend)
│   │   ├── public/
│   │   │   ├── icons/
│   │   │   └── manifest.json
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── auth/
│   │   │   │   ├── layout/
│   │   │   │   ├── providers/
│   │   │   │   └── ui/
│   │   │   ├── features/
│   │   │   │   ├── public/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── cashflow/
│   │   │   │   ├── debts/
│   │   │   │   ├── trading/
│   │   │   │   ├── reports/
│   │   │   │   └── settings/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   ├── api/
│   │   │   │   └── supabase/
│   │   │   ├── router/
│   │   │   ├── store/
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── vite-env.d.ts
│   │   ├── .env
│   │   ├── .env.example
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   │
│   └── web/                    # Next.js (Backend/API)
│       ├── src/
│       │   ├── app/
│       │   │   └── api/
│       │   │       ├── auth/
│       │   │       ├── cashflow/
│       │   │       ├── debts/
│       │   │       ├── trading/
│       │   │       └── reports/
│       │   ├── lib/
│       │   │   ├── supabase/
│       │   │   └── auth.ts
│       │   └── types/
│       ├── .env
│       ├── .env.example
│       ├── next.config.mjs
│       ├── middleware.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                   # Shared packages (optional)
│   └── ui/                     # Shared UI components
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/                   # Supabase configuration
├── docs/                       # Documentation
├── .gitignore
├── pnpm-workspace.yaml
├── package.json                # Root package.json
├── pnpm-lock.yaml
└── README.md
```

---

## ✅ Checklist tổng

### Monorepo Setup ✅
- [x] Tạo folder structure mới
- [x] Cấu hình pnpm workspace
- [x] Update root package.json (pnpm --filter syntax)
- [x] Setup concurrently cho dev

### Client (React + Vite) ✅
- [x] Tạo Vite project trong apps/client
- [x] Cài đặt dependencies
- [x] Cấu hình Vite + TypeScript
- [x] Cấu hình Tailwind CSS
- [x] Setup environment variables
- [x] Configure API proxy
- [x] iOS Optimization (PWA, chặn zoom)

### Web (Next.js API) ✅
- [x] Move Next.js vào apps/web
- [x] Update CORS middleware
- [x] Cấu hình API routes (auth, cashflow, debts, trading, partners, reports)
- [x] Setup environment variables
- [x] iOS PWA optimization (manifest.json, meta tags)

### Routing ✅
- [x] Cài React Router
- [x] Tạo router config (25+ routes)
- [x] Map tất cả routes
- [x] Tạo ProtectedRoute component

### Authentication ✅
- [x] Tạo API client (axios)
- [x] Tạo Supabase client
- [x] Tạo useAuth hook (Supabase direct)
- [x] Tạo Next.js auth API routes (/api/auth/login, /api/auth/register, /api/auth/me)
- [x] Update login/register forms
- [x] Test auth flow

### Components ✅
- [x] Di chuyển UI components
- [x] Di chuyển layout components (MainLayout)
- [x] Convert MainLayout (React Router)
- [x] Update providers (QueryProvider, MoneyVisibilityProvider)
- [x] Remove "use client" directives
- [x] IOSOptimization component

### State Management ✅
- [x] Giữ nguyên Zustand stores (money-visibility, notifications, ui)
- [x] Update React Query Provider
- [x] Update App.tsx với RouterProvider

### Pages ✅
- [x] Convert LandingPage
- [x] Convert auth pages (Login, Register)
- [x] Convert Dashboard
- [x] Convert Cashflow module (CashflowPage, Accounts, Categories, New)
- [x] Convert Debts module (DebtsPage, New, Partners, Detail)
- [x] Convert Partners module
- [x] Convert Trading module (Dashboard, Accounts, Orders, Funding, Ledger)
- [x] Convert Reports module
- [x] Convert Settings module (Settings, Profile, Report Dates, Telegram)

### API Integration ✅
- [x] Tạo API client functions
- [x] Update React Query hooks
- [x] Tạo Next.js API routes:
  - Auth: login, register, me
  - Cashflow: transactions, accounts, categories, report-transactions
  - Debts: route, payments, partners
  - Partners: route, transactions
  - Trading: orders, funding, balance-accounts, sync-ledger
  - Reports: report-runs
  - Telegram: webhook
- [x] Test client ↔ API communication
- [x] Handle errors & loading states

### Build & Deploy ⏳
- [ ] Update package.json scripts
- [ ] Test local build
- [ ] Configure production deploy
- [ ] Setup CI/CD
- [ ] Deploy & test production

---

## 📊 Progress Summary

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Setup & Configuration | ✅ Completed | 100% |
| Phase 2: Core Infrastructure | ✅ Completed | 100% |
| Phase 3: API Development | ✅ Completed | 100% |
| Phase 4: Pages Migration | ✅ Completed | 100% |
| Phase 5: Testing & Deploy | ⏳ Pending | 0% |

**Overall Progress: ~85% Complete**

---

## 🎯 Next Steps (Phase 5)

1. **Test local build** - Chạy `pnpm build:client` và `pnpm build:web` để verify
2. **Configure production** - Setup environment variables cho production
3. **Deploy testing** - Test deploy lên Vercel/Railway
4. **E2E testing** - Test toàn bộ user flows
5. **Performance optimization** - Optimize bundle size, lazy loading

---

## 🔧 Development Workflow

### Chạy development server
```bash
# Root directory
npm run dev
# Hoặc
pnpm dev

# Chạy riêng client
npm run dev:client

# Chạy riêng web
npm run dev:web
```

### Build production
```bash
# Build tất cả
npm run build

# Build riêng client
npm run build:client

# Build riêng web
npm run build:web
```

---

**Generated:** 2026-03-01  
**Last Updated:** 2026-03-01
**Project:** XPer Finance
**Architecture:** Monorepo (Next.js API + React Vite Client)
**Frontend:** React 18 + Vite + React Router v6
**Backend:** Next.js 16 (API Server)
**Status:** Phase 1-4 Complete (85%) - Ready for Phase 5 (Testing & Deploy)
