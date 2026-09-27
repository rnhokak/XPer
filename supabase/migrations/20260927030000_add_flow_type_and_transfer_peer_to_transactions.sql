-- Migration: Add flow_type (boolean: true = increase, false = decrease) and transfer_peer_id to transactions table

alter table if exists public.transactions
  add column if not exists flow_type boolean not null default false,
  add column if not exists transfer_peer_id uuid;

-- Add foreign key constraint for transfer_peer_id with cascade delete
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_transfer_peer_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_transfer_peer_id_fkey
      foreign key (transfer_peer_id)
      references public.transactions (id)
      on delete cascade;
  end if;
end $$;

-- Create index on transfer_peer_id
create index if not exists transactions_transfer_peer_idx on public.transactions (transfer_peer_id);

-- Backfill existing transactions:
-- income -> flow_type = true (increase)
-- expense -> flow_type = false (decrease)
-- transfer -> flow_type = false (existing single records represented the outflow)
update public.transactions
set flow_type = true
where type = 'income';

update public.transactions
set flow_type = false
where type in ('expense', 'transfer');
