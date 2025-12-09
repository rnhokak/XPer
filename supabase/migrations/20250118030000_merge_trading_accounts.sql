-- Merge trading_accounts into balance_accounts and remove trading_accounts table.

-- Add trading detail columns to balance_accounts
alter table if exists public.balance_accounts
  add column if not exists broker text,
  add column if not exists platform text,
  add column if not exists account_number text,
  add column if not exists is_demo boolean not null default false;

-- Backfill trading detail from trading_accounts if present
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'trading_accounts' and table_schema = 'public') then
    update public.balance_accounts ba
    set
      broker = ta.broker,
      platform = ta.platform,
      account_number = ta.account_number,
      is_demo = coalesce(ta.is_demo, false)
    from public.trading_accounts ta
    where ta.balance_account_id = ba.id;
  end if;
end$$;

-- Drop triggers/functions that reference trading_accounts on orders
drop trigger if exists trg_enforce_trading_order_account_link on public.trading_orders;
drop function if exists public.enforce_trading_order_account_link cascade;
drop trigger if exists trg_enforce_trading_account_type on public.trading_accounts;
drop function if exists public.enforce_trading_account_type cascade;

-- Remove trading_account_id column and relax constraint to require only balance_account_id
alter table if exists public.trading_orders
  drop column if exists trading_account_id;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'trading_orders_balance_account_required') then
    alter table public.trading_orders drop constraint trading_orders_balance_account_required;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trading_orders_balance_account_only') then
    alter table public.trading_orders
      add constraint trading_orders_balance_account_only
        check (balance_account_id is not null) not valid;
  end if;
end$$;

-- Enforce balance_account_id belongs to user and type TRADING
create or replace function public.enforce_trading_order_balance_account() returns trigger as $$
declare
  ba record;
begin
  if new.balance_account_id is null then
    raise exception 'balance_account_id is required';
  end if;
  select * into ba from public.balance_accounts where id = new.balance_account_id;
  if not found then
    raise exception 'Balance account % not found', new.balance_account_id;
  end if;
  if ba.account_type <> 'TRADING' then
    raise exception 'Balance account % must be TRADING', new.balance_account_id;
  end if;
  if ba.user_id <> new.user_id then
    raise exception 'Balance account % does not belong to user', new.balance_account_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_trading_order_balance_account on public.trading_orders;
create constraint trigger trg_enforce_trading_order_balance_account
  after insert or update on public.trading_orders
  for each row
  execute function public.enforce_trading_order_balance_account();

-- Drop trading_accounts table (detail now on balance_accounts)
drop table if exists public.trading_accounts cascade;
