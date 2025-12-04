-- Trading module schema for funding and orders tables with RLS.
-- Run: supabase db push (local) or apply in the Supabase SQL editor.

-- Extensions
create extension if not exists "pgcrypto";

-- Funding transactions
create table if not exists public.trading_funding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdraw')),
  amount numeric not null,
  currency text not null,
  method text not null,
  note text,
  transaction_time timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists trading_funding_user_time_idx on public.trading_funding (user_id, transaction_time desc);

-- Trading orders
create table if not exists public.trading_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  entry_price numeric not null,
  sl_price numeric,
  tp_price numeric,
  volume numeric not null,
  leverage integer,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  open_time timestamptz not null,
  close_time timestamptz,
  close_price numeric,
  pnl_amount numeric,
  pnl_percent numeric,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists trading_orders_user_time_idx on public.trading_orders (user_id, open_time desc);
create index if not exists trading_orders_status_idx on public.trading_orders (user_id, status);

-- Row Level Security
alter table public.trading_funding enable row level security;
alter table public.trading_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_funding' and policyname = 'select own funding'
  ) then
    create policy "select own funding" on public.trading_funding for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_funding' and policyname = 'insert own funding'
  ) then
    create policy "insert own funding" on public.trading_funding for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_funding' and policyname = 'update own funding'
  ) then
    create policy "update own funding" on public.trading_funding for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_funding' and policyname = 'delete own funding'
  ) then
    create policy "delete own funding" on public.trading_funding for delete using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_orders' and policyname = 'select own orders'
  ) then
    create policy "select own orders" on public.trading_orders for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_orders' and policyname = 'insert own orders'
  ) then
    create policy "insert own orders" on public.trading_orders for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_orders' and policyname = 'update own orders'
  ) then
    create policy "update own orders" on public.trading_orders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_orders' and policyname = 'delete own orders'
  ) then
    create policy "delete own orders" on public.trading_orders for delete using (auth.uid() = user_id);
  end if;
end$$;
