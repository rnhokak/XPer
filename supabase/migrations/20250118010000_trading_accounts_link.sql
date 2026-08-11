-- Link trading orders to trading balance accounts and enforce account type separation.

-- Enforce trading/funding account detail rows reference the right balance account type
create or replace function public.enforce_trading_account_type() returns trigger as $$
declare
  ba record;
begin
  select * into ba from public.balance_accounts where id = new.balance_account_id;
  if not found then
    raise exception 'Balance account % does not exist', new.balance_account_id;
  end if;
  if ba.account_type <> 'TRADING' then
    raise exception 'Balance account % must have account_type TRADING', new.balance_account_id;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.enforce_funding_account_type() returns trigger as $$
declare
  ba record;
begin
  select * into ba from public.balance_accounts where id = new.balance_account_id;
  if not found then
    raise exception 'Balance account % does not exist', new.balance_account_id;
  end if;
  if ba.account_type <> 'FUNDING' then
    raise exception 'Balance account % must have account_type FUNDING', new.balance_account_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_trading_account_type on public.trading_accounts;
create constraint trigger trg_enforce_trading_account_type
  after insert or update on public.trading_accounts
  for each row
  execute function public.enforce_trading_account_type();

drop trigger if exists trg_enforce_funding_account_type on public.funding_accounts;
create constraint trigger trg_enforce_funding_account_type
  after insert or update on public.funding_accounts
  for each row
  execute function public.enforce_funding_account_type();

-- Link trading orders to trading accounts and balance accounts
alter table public.trading_orders
  add column if not exists trading_account_id uuid references public.trading_accounts (id) on delete restrict,
  add column if not exists balance_account_id uuid references public.balance_accounts (id) on delete restrict;

-- Require linkage for new rows while avoiding failures on existing legacy data
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trading_orders_balance_account_required') then
    alter table public.trading_orders
      add constraint trading_orders_balance_account_required
        check (balance_account_id is not null and trading_account_id is not null) not valid;
  end if;
end$$;

create index if not exists trading_orders_trading_account_idx on public.trading_orders (trading_account_id);
create index if not exists trading_orders_balance_account_idx on public.trading_orders (balance_account_id);

-- Enforce account relationship and ownership consistency on insert/update
create or replace function public.enforce_trading_order_account_link() returns trigger as $$
declare
  ba record;
  ta record;
begin
  if new.trading_account_id is null or new.balance_account_id is null then
    raise exception 'Trading orders must reference trading_account_id and balance_account_id';
  end if;

  select * into ta from public.trading_accounts where id = new.trading_account_id;
  if not found then
    raise exception 'Trading account % not found', new.trading_account_id;
  end if;

  select * into ba from public.balance_accounts where id = new.balance_account_id;
  if not found then
    raise exception 'Balance account % not found', new.balance_account_id;
  end if;

  if ba.account_type <> 'TRADING' then
    raise exception 'Balance account % must be of type TRADING', new.balance_account_id;
  end if;

  if ta.balance_account_id <> ba.id then
    raise exception 'trading_account_id must belong to balance_account_id';
  end if;

  if ba.user_id <> new.user_id then
    raise exception 'Trading order user_id must match balance account owner';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_trading_order_account_link on public.trading_orders;
create constraint trigger trg_enforce_trading_order_account_link
  after insert or update on public.trading_orders
  for each row
  when (new.trading_account_id is not null or new.balance_account_id is not null)
  execute function public.enforce_trading_order_account_link();
