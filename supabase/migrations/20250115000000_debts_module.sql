-- Debts module: partners, debts, debt_payments with RLS. Integrates with cashflow transactions.
-- Safe to re-run thanks to IF NOT EXISTS guards.

create extension if not exists "pgcrypto";

-- Partners (people/institutions I borrow from or lend to)
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text,
  phone text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partners_user_idx on public.partners (user_id, created_at desc);

-- Debts (a single lending/borrowing agreement)
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  direction text not null check (direction in ('lend', 'borrow')),
  principal_amount numeric not null,
  currency text not null,
  start_date date not null,
  due_date date,
  interest_type text not null default 'none' check (interest_type in ('none', 'fixed', 'percent')),
  interest_rate numeric,
  interest_cycle text check (interest_cycle in ('day', 'month', 'year')),
  status text not null default 'ongoing' check (status in ('ongoing', 'paid_off', 'overdue', 'cancelled')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists debts_user_status_idx on public.debts (user_id, status, start_date desc);
create index if not exists debts_partner_idx on public.debts (user_id, partner_id);

-- Payments linked to cashflow transactions
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  payment_type text not null check (payment_type in ('disbursement', 'repayment', 'receive')),
  amount numeric not null,
  principal_amount numeric,
  interest_amount numeric,
  payment_date timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists debt_payments_user_debt_idx on public.debt_payments (user_id, debt_id, payment_date desc);
create unique index if not exists debt_payments_transaction_uidx on public.debt_payments (user_id, transaction_id);

-- Row Level Security
alter table public.partners enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'select own partners') then
    create policy "select own partners" on public.partners for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'insert own partners') then
    create policy "insert own partners" on public.partners for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'update own partners') then
    create policy "update own partners" on public.partners for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partners' and policyname = 'delete own partners') then
    create policy "delete own partners" on public.partners for delete using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debts' and policyname = 'select own debts') then
    create policy "select own debts" on public.debts for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debts' and policyname = 'insert own debts') then
    create policy "insert own debts" on public.debts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debts' and policyname = 'update own debts') then
    create policy "update own debts" on public.debts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debts' and policyname = 'delete own debts') then
    create policy "delete own debts" on public.debts for delete using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debt_payments' and policyname = 'select own debt payments') then
    create policy "select own debt payments" on public.debt_payments for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debt_payments' and policyname = 'insert own debt payments') then
    create policy "insert own debt payments" on public.debt_payments for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debt_payments' and policyname = 'update own debt payments') then
    create policy "update own debt payments" on public.debt_payments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'debt_payments' and policyname = 'delete own debt payments') then
    create policy "delete own debt payments" on public.debt_payments for delete using (auth.uid() = user_id);
  end if;
end$$;
