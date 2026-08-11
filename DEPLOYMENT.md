# Hướng dẫn Deploy lên Vercel (Option 1)

## Tổng quan

Deploy cả 2 apps (web và client) trong cùng 1 Vercel project.

- **Web App (Next.js)**: Serve API routes và SSR pages
- **Client App (React/Vite)**: Serve như static files từ `/app` route

---

## Cách truy cập

Sau khi deploy:

- **Trang chủ**: `https://your-domain.com` → redirect vào Client App
- **Client App**: `https://your-domain.com/app`
- **Next.js Pages**: `https://your-domain.com/auth/login`, `/dashboard`, v.v.
- **API Routes**: `https://your-domain.com/api/*`

---

## Cấu hình Vercel

### Bước 1: Connect GitHub Repo

1. Vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Chọn GitHub repo của bạn
4. Click **"Import"**

### Bước 2: Cấu hình Build Settings

- **Framework Preset**: Next.js
- **Root Directory**: Để trống (để root của monorepo)
- **Build Command**: `pnpm run build`
- **Output Directory**: Để trống (Vercel tự detect)
- **Install Command**: `pnpm install`

### Bước 3: Environment Variables

Thêm các biến môi trường sau:

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# CORS (optional)
CORS_ALLOWED_ORIGINS=https://your-domain.vercel.app

# Client (if needed)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Bước 4: Deploy

Click **"Deploy"** và chờ Vercel build xong!

---

## Local Development

### Chạy cả 2 apps cùng lúc:

```bash
# Root directory
pnpm run dev
```

Lệnh này sẽ chạy:
- Web app: `http://localhost:3005`
- Client app: `http://localhost:3001`

### Truy cập local:

- **Client App**: http://localhost:3001
- **Web App**: http://localhost:3005
- **API**: http://localhost:3005/api/*

---

## Cấu trúc routes sau khi deploy

```
https://your-domain.com/
├── /app                    → React Client App (SPA)
│   ├── /cashflow
│   ├── /debts
│   ├── /reports
│   └── ...
│
├── /auth                   → Next.js Auth Pages
│   ├── /login
│   └── /register
│
├── /dashboard              → Next.js Dashboard Page
├── /cashflow               → Next.js Cashflow Pages (SSR)
├── /debts                  → Next.js Debts Pages (SSR)
├── /reports                → Next.js Reports Pages (SSR)
├── /settings               → Next.js Settings Pages (SSR)
├── /trading                → Next.js Trading Pages (SSR)
│
└── /api                    → API Routes (shared)
    ├── /auth/*
    ├── /cashflow/*
    ├── /debts/*
    └── ...
```

---

## Lưu ý quan trọng

### 1. Client App build vào web/public

Khi chạy `pnpm run build`, client app sẽ build vào `apps/web/public` folder.

Next.js sẽ tự động serve các file này từ route `/app`.

### 2. API calls từ Client

- **Development**: Client gọi API qua proxy → `http://localhost:3005/api/*`
- **Production**: Client gọi API cùng origin → `/api/*`

### 3. Authentication

Cả 2 apps dùng chung auth token từ localStorage.

---

## Troubleshooting

### Client app không hiển thị?

Kiểm tra xem client đã build chưa:
```bash
pnpm run build:client
```

Check folder `apps/web/public` có file `index.html` không.

### API calls bị lỗi 404?

Đảm bảo Next.js server đang chạy và API routes được cấu hình đúng.

### CORS errors?

Trong production, cả 2 apps cùng origin nên không có CORS issues.

Trong development, proxy đã được cấu hình trong `vite.config.ts`.

---

## Custom Domain

Nếu muốn dùng custom domain:

1. Vào Vercel Dashboard → Project Settings → Domains
2. Thêm domain của bạn
3. Cấu hình DNS theo hướng dẫn của Vercel

---

## Chi phí

Vercel Free tier bao gồm:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/tháng
- ✅ 100GB build minutes/tháng
- ✅ Automatic HTTPS
- ✅ Custom domains

Đủ cho most personal projects!
