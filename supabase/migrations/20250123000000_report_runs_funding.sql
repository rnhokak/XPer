-- Extend report_runs to include funding reports and add funding summary function.
create extension if not exists "pgcrypto";

alter table public.report_runs drop constraint if exists report_runs_type_check;
alter table public.report_runs add constraint report_runs_type_check check (type in ('cashflow', 'trading', 'funding'));

create or replace function public.report_funding_summary(p_user_id uuid, p_start_time timestamptz)
returns table (
  deposit_total numeric,
  withdraw_total numeric,
  net_amount numeric,
  transaction_count integer
)
language sql stable as $$
  select
    coalesce(sum(case when f.type = 'deposit' then f.amount end), 0) as deposit_total,
    coalesce(sum(case when f.type = 'withdraw' then f.amount end), 0) as withdraw_total,
    coalesce(
      sum(
        case
          when f.type = 'deposit' then f.amount
          when f.type = 'withdraw' then -f.amount
          else 0
        end
      ),
      0
    ) as net_amount,
    count(*) filter (where f.type in ('deposit', 'withdraw')) as transaction_count
  from public.trading_funding f
  where f.user_id = p_user_id and f.transaction_time >= p_start_time;
$$;
