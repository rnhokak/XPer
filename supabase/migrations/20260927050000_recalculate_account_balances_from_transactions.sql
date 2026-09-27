-- Migration: Recalculate balance for all accounts based on transactions
--
-- Logic for calculating account balance from transaction history:
-- 1. Inflow (+ amount):
--    - type = 'income'
--    - type = 'transfer' with flow_type = true (receiving leg of a transfer)
-- 2. Outflow (- amount):
--    - type = 'expense'
--    - type = 'transfer' with flow_type = false or flow_type is null (sending leg of a transfer)
-- 3. Legacy single-record transfers (+ destination_amount or amount):
--    - Transfers without transfer_peer_id where destination_account_id = account.id

update public.accounts a
set balance = coalesce((
  select sum(
    case
      -- Income & receiving transfer: + amount
      when t.type = 'income' or (t.type = 'transfer' and t.flow_type = true)
        then t.amount
      -- Expense & sending transfer: - amount
      when t.type = 'expense' or (t.type = 'transfer' and (t.flow_type = false or t.flow_type is null))
        then -t.amount
      else 0
    end
  )
  from public.transactions t
  where t.account_id = a.id
), 0) + coalesce((
  -- Legacy single-record transfers where this account was destination
  select sum(coalesce(t.destination_amount, t.amount))
  from public.transactions t
  where t.type = 'transfer'
    and t.transfer_peer_id is null
    and t.destination_account_id = a.id
    and (t.account_id is null or t.account_id <> a.id)
), 0);
