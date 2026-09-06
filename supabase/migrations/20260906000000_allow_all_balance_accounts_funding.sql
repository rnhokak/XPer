-- Allow both TRADING and FUNDING balance accounts for trading funding records

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
  if ba.account_type not in ('TRADING', 'FUNDING') then
    raise exception 'Balance account % must be TRADING or FUNDING', new.balance_account_id;
  end if;
  if ba.user_id <> new.user_id then
    raise exception 'Balance account % does not belong to user', new.balance_account_id;
  end if;
  return new;
end;
$$ language plpgsql;

