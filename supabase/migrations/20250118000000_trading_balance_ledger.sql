-- Trading balance ledger architecture: balance accounts, detail tables, ledgers, snapshots, and helper view.
-- This module introduces wallet-like balance accounts that are distinct from the existing public.accounts cashflow table.

create extension if not exists "pgcrypto";

-- Core balance accounts (wallets)
create table if not exists public.balance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_type text not null check (account_type in ('TRADING', 'FUNDING')),
  name text not null,
  currency text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists balance_accounts_user_idx on public.balance_accounts (user_id, account_type, is_active, created_at desc);

-- Trading account details (1-1 with balance_accounts when type = TRADING)
create table if not exists public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  balance_account_id uuid not null references public.balance_accounts (id) on delete cascade,
  broker text,
  platform text,
  account_number text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (balance_account_id)
);

-- Funding account details (1-1 with balance_accounts when type = FUNDING)
create table if not exists public.funding_accounts (
  id uuid primary key default gen_random_uuid(),
  balance_account_id uuid not null references public.balance_accounts (id) on delete cascade,
  provider text,
  note text,
  created_at timestamptz not null default now(),
  unique (balance_account_id)
);

-- Append-only balance ledger per balance account
create table if not exists public.trading_balance_ledger (
  id uuid primary key default gen_random_uuid(),
  balance_account_id uuid not null references public.balance_accounts (id) on delete cascade,
  source_type text not null check (
    source_type in (
      'DEPOSIT',
      'WITHDRAW',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'TRADE_PNL',
      'COMMISSION',
      'SWAP',
      'BONUS',
      'BONUS_REMOVAL',
      'ADJUSTMENT'
    )
  ),
  source_ref_id text,
  amount numeric not null,
  balance_after numeric not null,
  occurred_at timestamptz not null,
  currency text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trading_balance_ledger_account_time_idx on public.trading_balance_ledger (balance_account_id, occurred_at, created_at, id);
create index if not exists trading_balance_ledger_source_idx on public.trading_balance_ledger (source_type, source_ref_id);

-- Daily balance snapshots per balance account
create table if not exists public.trading_daily_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  balance_account_id uuid not null references public.balance_accounts (id) on delete cascade,
  date date not null,
  opening_balance numeric not null default 0,
  closing_balance numeric not null default 0,
  net_change numeric not null default 0,
  deposit_amount numeric not null default 0,
  withdraw_amount numeric not null default 0,
  transfer_in_amount numeric not null default 0,
  transfer_out_amount numeric not null default 0,
  trading_net_result numeric not null default 0,
  adjustment_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (balance_account_id, date)
);

create index if not exists trading_daily_balance_snapshots_account_date_idx on public.trading_daily_balance_snapshots (balance_account_id, date desc);

-- Helper view: latest balance per balance_account (balance_after on most recent ledger row)
create or replace view public.balance_account_latest_balances as
select
  ba.id as balance_account_id,
  ba.user_id,
  ba.account_type,
  ba.name,
  ba.currency,
  ba.is_active,
  ba.created_at,
  lbl.balance_after as current_balance,
  lbl.occurred_at as balance_at
from public.balance_accounts ba
left join lateral (
  select tbl.balance_after, tbl.occurred_at
  from public.trading_balance_ledger tbl
  where tbl.balance_account_id = ba.id
  order by tbl.occurred_at desc, tbl.created_at desc, tbl.id desc
  limit 1
) lbl on true;

-- Row Level Security
alter table public.balance_accounts enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.funding_accounts enable row level security;
alter table public.trading_balance_ledger enable row level security;
alter table public.trading_daily_balance_snapshots enable row level security;

-- Balance accounts: owner-only access, soft-delete via is_active (no delete policy)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'balance_accounts' and policyname = 'select own balance accounts'
  ) then
    create policy "select own balance accounts" on public.balance_accounts for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'balance_accounts' and policyname = 'insert own balance accounts'
  ) then
    create policy "insert own balance accounts" on public.balance_accounts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'balance_accounts' and policyname = 'update own balance accounts'
  ) then
    create policy "update own balance accounts" on public.balance_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end$$;

-- Trading accounts detail: must belong to a TRADING balance account owned by user
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_accounts' and policyname = 'select own trading accounts'
  ) then
    create policy "select own trading accounts" on public.trading_accounts
      for select using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_accounts' and policyname = 'insert own trading accounts'
  ) then
    create policy "insert own trading accounts" on public.trading_accounts
      for insert with check (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid() and ba.account_type = 'TRADING'
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_accounts' and policyname = 'update own trading accounts'
  ) then
    create policy "update own trading accounts" on public.trading_accounts
      for update using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid() and ba.account_type = 'TRADING'
        )
      );
  end if;
end$$;

-- Funding accounts detail: must belong to a FUNDING balance account owned by user
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'funding_accounts' and policyname = 'select own funding accounts'
  ) then
    create policy "select own funding accounts" on public.funding_accounts
      for select using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'funding_accounts' and policyname = 'insert own funding accounts'
  ) then
    create policy "insert own funding accounts" on public.funding_accounts
      for insert with check (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid() and ba.account_type = 'FUNDING'
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'funding_accounts' and policyname = 'update own funding accounts'
  ) then
    create policy "update own funding accounts" on public.funding_accounts
      for update using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid() and ba.account_type = 'FUNDING'
        )
      );
  end if;
end$$;

-- Ledger: append-only, owner must match balance account. No update/delete policies are defined.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_balance_ledger' and policyname = 'select own balance ledger'
  ) then
    create policy "select own balance ledger" on public.trading_balance_ledger
      for select using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_balance_ledger' and policyname = 'insert own balance ledger'
  ) then
    create policy "insert own balance ledger" on public.trading_balance_ledger
      for insert with check (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      );
  end if;
end$$;

-- Daily snapshots: recomputed/inserted per account/date, owner must match balance account.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_daily_balance_snapshots' and policyname = 'select own balance snapshots'
  ) then
    create policy "select own balance snapshots" on public.trading_daily_balance_snapshots
      for select using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_daily_balance_snapshots' and policyname = 'upsert own balance snapshots'
  ) then
    create policy "upsert own balance snapshots" on public.trading_daily_balance_snapshots
      for all using (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      ) with check (
        exists (
          select 1 from public.balance_accounts ba
          where ba.id = balance_account_id and ba.user_id = auth.uid()
        )
      );
  end if;
end$$;
