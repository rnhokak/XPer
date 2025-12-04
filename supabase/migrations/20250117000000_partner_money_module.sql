-- Money by Partner module: unified partner transactions + balances view
-- Adds partner_transactions table and partner_balances view with RLS policies.

create extension if not exists "pgcrypto";

create table if not exists public.partner_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  direction text not null check (direction in ('lend', 'borrow', 'repay', 'receive')),
  amount numeric not null,
  principal_amount numeric,
  interest_amount numeric,
  date timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists partner_transactions_tx_uidx on public.partner_transactions (user_id, transaction_id);
create index if not exists partner_transactions_user_idx on public.partner_transactions (user_id, date desc);
create index if not exists partner_transactions_partner_idx on public.partner_transactions (user_id, partner_id, date desc);

create or replace view public.partner_balances as
select
  pt.partner_id,
  coalesce(sum(case when pt.direction = 'lend' then pt.amount else 0 end), 0) as total_lent,
  coalesce(sum(case when pt.direction = 'borrow' then pt.amount else 0 end), 0) as total_borrowed,
  coalesce(sum(case when pt.direction = 'receive' then pt.amount else 0 end), 0) as total_receive,
  coalesce(sum(case when pt.direction = 'repay' then pt.amount else 0 end), 0) as total_repay,
  (coalesce(sum(case when pt.direction = 'lend' then pt.amount else 0 end), 0) - coalesce(sum(case when pt.direction = 'receive' then pt.amount else 0 end), 0))
    - (coalesce(sum(case when pt.direction = 'borrow' then pt.amount else 0 end), 0) - coalesce(sum(case when pt.direction = 'repay' then pt.amount else 0 end), 0))
    as balance
from public.partner_transactions pt
group by pt.partner_id;

alter table public.partner_transactions enable row level security;

-- RLS policies: own rows only
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_transactions' AND policyname = 'select own partner tx') THEN
    CREATE POLICY "select own partner tx" ON public.partner_transactions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_transactions' AND policyname = 'insert own partner tx') THEN
    CREATE POLICY "insert own partner tx" ON public.partner_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_transactions' AND policyname = 'update own partner tx') THEN
    CREATE POLICY "update own partner tx" ON public.partner_transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_transactions' AND policyname = 'delete own partner tx') THEN
    CREATE POLICY "delete own partner tx" ON public.partner_transactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;
