-- Migration: Backfill transfer records by creating 'Vợ' account (type = 'other', currency = 'VND')
-- and creating paired inflow transfer records (flow_type = true) for each existing transfer transaction.

do $$
declare
  tx record;
  wife_account_id uuid;
  new_peer_id uuid;
begin
  -- Loop through all existing transfer transactions that do not yet have a peer
  for tx in
    select t.*
    from public.transactions t
    where t.type = 'transfer'
      and t.transfer_peer_id is null
      and (t.flow_type = false or t.flow_type is null)
    order by t.transaction_time asc
  loop
    -- 1. Ensure account 'Vợ' exists for tx.user_id
    select id into wife_account_id
    from public.accounts
    where user_id = tx.user_id and name = 'Vợ'
    limit 1;

    if wife_account_id is null then
      insert into public.accounts (user_id, name, type, currency, is_default, balance)
      values (tx.user_id, 'Vợ', 'other', 'VND', false, 0)
      returning id into wife_account_id;
    end if;

    new_peer_id := gen_random_uuid();

    -- 2. Insert the inflow transfer transaction for 'Vợ' (flow_type = true)
    insert into public.transactions (
      id,
      user_id,
      type,
      flow_type,
      transfer_peer_id,
      account_id,
      destination_account_id,
      amount,
      currency,
      destination_amount,
      destination_currency,
      exchange_rate,
      category_id,
      note,
      transaction_time,
      created_at
    ) values (
      new_peer_id,
      tx.user_id,
      'transfer',
      true, -- Tiền tăng vào tài khoản Vợ
      tx.id,
      wife_account_id,       -- Tài khoản nhận: Vợ
      tx.account_id,         -- Nguồn chuyển đi
      coalesce(tx.destination_amount, tx.amount),
      'VND',
      tx.amount,
      tx.currency,
      tx.exchange_rate,
      null,
      tx.note,
      tx.transaction_time,
      coalesce(tx.created_at, now())
    );

    -- 3. Update the existing transaction: set destination to 'Vợ', flow_type = false, and link peer
    update public.transactions
    set
      flow_type = false,
      destination_account_id = wife_account_id,
      destination_amount = coalesce(destination_amount, tx.amount),
      destination_currency = coalesce(destination_currency, 'VND'),
      transfer_peer_id = new_peer_id
    where id = tx.id;

  end loop;
end $$;
