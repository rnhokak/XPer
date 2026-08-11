-- Cashflow module: accounts, categories, transactions with RLS.
-- Safe to run multiple times; guards avoid duplicate policies.

create extension if not exists "pgcrypto";

-- Accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null default 'USD',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id, is_default desc, created_at desc);

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories (user_id, type, is_default desc, created_at desc);

-- Transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  currency text not null default 'USD',
  note text,
  transaction_time timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_time_idx on public.transactions (user_id, transaction_time desc);
create index if not exists transactions_category_idx on public.transactions (user_id, category_id);

-- RLS
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'select own accounts') then
    create policy "select own accounts" on public.accounts for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'insert own accounts') then
    create policy "insert own accounts" on public.accounts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'update own accounts') then
    create policy "update own accounts" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'delete own accounts') then
    create policy "delete own accounts" on public.accounts for delete using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'select own categories') then
    create policy "select own categories" on public.categories for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'insert own categories') then
    create policy "insert own categories" on public.categories for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'update own categories') then
    create policy "update own categories" on public.categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'delete own categories') then
    create policy "delete own categories" on public.categories for delete using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'select own transactions') then
    create policy "select own transactions" on public.transactions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'insert own transactions') then
    create policy "insert own transactions" on public.transactions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'update own transactions') then
    create policy "update own transactions" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'delete own transactions') then
    create policy "delete own transactions" on public.transactions for delete using (auth.uid() = user_id);
  end if;
end$$;
