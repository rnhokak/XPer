-- Add extra trading_orders columns to align with CSV import
alter table public.trading_orders
  add column if not exists ticket text,
  add column if not exists original_position_size numeric,
  add column if not exists commission_usd numeric,
  add column if not exists swap_usd numeric,
  add column if not exists equity_usd numeric,
  add column if not exists margin_level numeric,
  add column if not exists close_reason text;

-- Unique ticket per user to prevent duplicate imports
create unique index if not exists trading_orders_user_ticket_uidx
  on public.trading_orders (user_id, ticket)
  where ticket is not null;
