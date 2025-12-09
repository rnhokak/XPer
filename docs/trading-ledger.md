# Trading balance ledger (wallet accounts)

This module introduces balance-based wallets for trading and funding without touching the existing `public.accounts` cashflow table.

## Tables
- `balance_accounts`: core wallet per user with `account_type` (`TRADING` | `FUNDING`), `currency`, `is_active`.
- `trading_accounts`: 1-1 detail for `TRADING` balance accounts (broker, platform, account_number, is_demo).
- `funding_accounts`: 1-1 detail for `FUNDING` balance accounts (provider, note).
- `trading_balance_ledger`: append-only money movements per `balance_account_id` with `balance_after` as the single source of truth.
- `trading_daily_balance_snapshots`: one row per balance account per day, recomputed from ledger.
- `balance_account_latest_balances` view: current balance per account from the latest ledger row.

## Balance flow rules
- Deposit: `DEPOSIT` (+amount) on the trading/funding balance account.
- Withdraw: `WITHDRAW` (-amount) on the same balance account.
- Transfer (funding -> trading): `TRANSFER_OUT` (-amount) on funding + `TRANSFER_IN` (+amount) on trading in the same transaction.
- Trade close: `TRADE_PNL` (+/- grossPnl), `COMMISSION` (-commission), `SWAP` (-swap) as separate ledger rows in order of occurrence. Floating PnL is **never** booked.
- Bonus/adjustment: `BONUS`, `BONUS_REMOVAL`, `ADJUSTMENT` as explicit ledger events.
- Every ledger row updates `balance_after`; no updates or deletes (append-only).

## Daily snapshot generation
For each `balance_account_id` and date:
1) Find the latest `balance_after` before the day as `opening_balance`.
2) Take the last `balance_after` of the day (or `opening_balance` if none) as `closing_balance`.
3) Aggregate ledger rows within the day:
   - `deposit_amount` = sum(DEPOSIT)
   - `withdraw_amount` = abs(sum(WITHDRAW))
   - `transfer_in_amount` = sum(TRANSFER_IN)
   - `transfer_out_amount` = abs(sum(TRANSFER_OUT))
   - `trading_net_result` = sum(TRADE_PNL + COMMISSION + SWAP)
   - `adjustment_amount` = sum(ADJUSTMENT + BONUS + BONUS_REMOVAL)
4) `net_change = closing_balance - opening_balance`.
5) Upsert into `trading_daily_balance_snapshots (balance_account_id, date)`; idempotent and derived only from ledger.

## Dashboard query examples

### Global balance dashboard (all wallets)
Show every active balance account with current balance, today change, and month-to-date change:
```sql
with latest as (
  select * from balance_account_latest_balances where user_id = auth.uid() and is_active = true
),
today as (
  select balance_account_id, closing_balance
  from trading_daily_balance_snapshots
  where balance_account_id in (select balance_account_id from latest)
    and date = current_date
),
month_open as (
  -- closing balance of the day before month start is treated as opening
  select s.balance_account_id, s.closing_balance
  from trading_daily_balance_snapshots s
  join (
    select balance_account_id, max(date) as max_date
    from trading_daily_balance_snapshots
    where date < date_trunc('month', current_date)
    group by balance_account_id
  ) m on m.balance_account_id = s.balance_account_id and m.max_date = s.date
)
select
  l.balance_account_id,
  l.name,
  l.account_type,
  l.currency,
  coalesce(l.current_balance, 0) as current_balance,
  coalesce(t.closing_balance, l.current_balance) - coalesce(mo.closing_balance, 0) as today_change,
  coalesce(l.current_balance, 0) - coalesce(mo.closing_balance, 0) as mtd_change
from latest l
left join today t on t.balance_account_id = l.balance_account_id
left join month_open mo on mo.balance_account_id = l.balance_account_id
order by l.account_type, l.name;
```

### Trading account dashboard
- Balance vs. equity: equity = latest `balance_after` + runtime `floating_pnl` from open positions (floating PnL is not stored).
- Daily chart:
```sql
select
  date,
  opening_balance,
  closing_balance,
  trading_net_result,
  deposit_amount,
  withdraw_amount,
  transfer_in_amount,
  transfer_out_amount
from trading_daily_balance_snapshots
where balance_account_id = :trading_balance_account_id
order by date asc;
```
- Monthly breakdown by source type:
```sql
select source_type, sum(amount) as total_amount
from trading_balance_ledger
where balance_account_id = :trading_balance_account_id
  and occurred_at >= date_trunc('month', now())
group by source_type
order by source_type;
```

### Funding overview
- Funding wallet balances:
```sql
select *
from balance_account_latest_balances
where user_id = auth.uid()
  and account_type = 'FUNDING'
  and is_active = true;
```
- Net transfers from funding to trading:
```sql
select
  l.balance_account_id,
  l.name,
  sum(case when source_type = 'TRANSFER_OUT' then amount else 0 end) * -1 as total_sent
from trading_balance_ledger
join balance_accounts l on l.id = trading_balance_ledger.balance_account_id
where l.user_id = auth.uid() and l.account_type = 'FUNDING'
  and occurred_at >= date_trunc('month', now())
group by l.balance_account_id, l.name;
```

## Why ledger + snapshot?
- Balance is the only source of truth; no report sums PnL directly from orders.
- Append-only ledger ensures auditability and simplifies rollbacks via new entries instead of updates.
- Daily snapshots give fast reporting windows (today, MTD) without re-scanning entire ledgers.
- Separation of identity (`auth.users`), existing `public.accounts` (cashflow), and new `balance_accounts` prevents cross-feature coupling.
- Ledger schema is reusable: trading, personal finance, partner money can all emit ledger rows without new balance math.
