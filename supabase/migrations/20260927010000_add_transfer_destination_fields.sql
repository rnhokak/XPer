-- Migration: Add transfer destination account and currency exchange rate fields to transactions table

alter table if exists public.transactions
  add column if not exists destination_account_id uuid,
  add column if not exists destination_amount numeric,
  add column if not exists destination_currency text,
  add column if not exists exchange_rate numeric;

-- Add foreign key constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_destination_account_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_destination_account_id_fkey
      foreign key (destination_account_id)
      references public.accounts (id)
      on delete set null;
  end if;
end $$;

create index if not exists transactions_destination_account_idx on public.transactions (user_id, destination_account_id);
