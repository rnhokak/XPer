-- Add report run history plus helper summary functions.
create extension if not exists "pgcrypto";

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('cashflow', 'trading')),
  report_date timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists report_runs_user_type_date_idx on public.report_runs (user_id, type, report_date desc);

alter table public.report_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'report_runs' and policyname = 'select own report runs'
  ) then
    create policy "select own report runs" on public.report_runs for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'report_runs' and policyname = 'insert own report runs'
  ) then
    create policy "insert own report runs" on public.report_runs for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'report_runs' and policyname = 'update own report runs'
  ) then
    create policy "update own report runs" on public.report_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'report_runs' and policyname = 'delete own report runs'
  ) then
    create policy "delete own report runs" on public.report_runs for delete using (auth.uid() = user_id);
  end if;
end$$;

create or replace function public.report_cashflow_summary(p_user_id uuid, p_start_time timestamptz)
returns table (
  total_income numeric,
  total_expense numeric,
  net_amount numeric,
  transaction_count integer
)
language sql stable as $$
  select
    coalesce(sum(case when t.type = 'income' then t.amount end), 0) as total_income,
    coalesce(sum(case when t.type = 'expense' then t.amount end), 0) as total_expense,
    coalesce(sum(
      case
        when t.type = 'income' then t.amount
        when t.type = 'expense' then -t.amount
        else 0
      end
    ), 0) as net_amount,
    count(*) filter (where t.type in ('income', 'expense')) as transaction_count
  from public.transactions t
  where t.user_id = p_user_id and t.transaction_time >= p_start_time;
$$;

create or replace function public.report_trading_summary(p_user_id uuid, p_start_time timestamptz)
returns table (
  pnl_total numeric,
  win_trades integer,
  loss_trades integer,
  neutral_trades integer,
  trade_count integer,
  average_pnl numeric
)
language sql stable as $$
  select
    coalesce(sum(coalesce(t.pnl_amount, 0)), 0) as pnl_total,
    count(*) filter (where coalesce(t.pnl_amount, 0) > 0) as win_trades,
    count(*) filter (where coalesce(t.pnl_amount, 0) < 0) as loss_trades,
    count(*) filter (where coalesce(t.pnl_amount, 0) = 0) as neutral_trades,
    count(*) as trade_count,
    case when count(*) = 0 then 0 else coalesce(sum(coalesce(t.pnl_amount, 0)), 0) / count(*) end as average_pnl
  from public.trading_orders t
  where t.user_id = p_user_id and t.status = 'closed' and t.close_time >= p_start_time;
$$;
