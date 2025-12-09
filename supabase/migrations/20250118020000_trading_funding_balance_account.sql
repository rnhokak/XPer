-- Link trading_funding rows to funding balance accounts.

alter table if exists public.trading_funding
  add column if not exists balance_account_id uuid references public.balance_accounts (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trading_funding_balance_account_required'
  ) then
    alter table public.trading_funding
      add constraint trading_funding_balance_account_required
        check (balance_account_id is not null) not valid;
  end if;
end$$;

create or replace function public.enforce_trading_funding_account() returns trigger as $$
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
  if ba.account_type <> 'FUNDING' then
    raise exception 'Balance account % must be FUNDING', new.balance_account_id;
  end if;
  if ba.user_id <> new.user_id then
    raise exception 'Balance account % does not belong to user', new.balance_account_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_trading_funding_account on public.trading_funding;
create constraint trigger trg_enforce_trading_funding_account
  after insert or update on public.trading_funding
  for each row
  execute function public.enforce_trading_funding_account();
