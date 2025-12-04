-- Mark imported orders so they cannot be edited/deleted from UI
alter table public.trading_orders
  add column if not exists is_imported boolean not null default false;
