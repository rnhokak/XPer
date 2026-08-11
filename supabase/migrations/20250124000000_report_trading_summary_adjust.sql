-- Adjust trading summary to report USD net PnL that includes commissions and swaps.
create extension if not exists "pgcrypto";

-- Drop the existing function to allow changing the return type
drop function if exists public.report_trading_summary(uuid, timestamptz);

create or replace function public.report_trading_summary(p_user_id uuid, p_start_time timestamptz)
returns table (
  pnl_total numeric,
  commission_total numeric,
  swap_total numeric,
  win_trades integer,
  loss_trades integer,
  neutral_trades integer,
  trade_count integer,
  average_pnl numeric
)
language sql stable as $$
  select
    coalesce(sum(coalesce(t.pnl_amount, 0) - coalesce(t.commission_usd, 0) - coalesce(t.swap_usd, 0)), 0) as pnl_total,
    coalesce(sum(coalesce(t.commission_usd, 0)), 0) as commission_total,
    coalesce(sum(coalesce(t.swap_usd, 0)), 0) as swap_total,
    count(*) filter (where (coalesce(t.pnl_amount, 0) - coalesce(t.commission_usd, 0) - coalesce(t.swap_usd, 0)) > 0) as win_trades,
    count(*) filter (where (coalesce(t.pnl_amount, 0) - coalesce(t.commission_usd, 0) - coalesce(t.swap_usd, 0)) < 0) as loss_trades,
    count(*) filter (where (coalesce(t.pnl_amount, 0) - coalesce(t.commission_usd, 0) - coalesce(t.swap_usd, 0)) = 0) as neutral_trades,
    count(*) as trade_count,
    case when count(*) = 0 then 0 else coalesce(sum(coalesce(t.pnl_amount, 0) - coalesce(t.commission_usd, 0) - coalesce(t.swap_usd, 0)), 0) / count(*) end as average_pnl
  from public.trading_orders t
  where t.user_id = p_user_id and t.status = 'closed' and t.close_time >= p_start_time;
$$;
