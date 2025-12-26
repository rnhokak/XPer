API Reference (Next.js /api routes)

Base
- Base path: /api
- Auth: all endpoints (except /api/telegram/webhook) require a Supabase session cookie. Client fetch should send cookies (credentials: include).
- Error shape (most endpoints): { "error": string }

Auth
GET /api/auth/me
- Query: none
- Body: none
- Response 200:
  {
    "user": {
      "id": string,
      "email": string | null,
      "user_metadata": object | null,
      "...": "Supabase user fields"
    }
  }
- Response 401: { "error": "Unauthorized" }

Cashflow
GET /api/cashflow/accounts
- Response 200: Array<{ id, name, type, currency, is_default, created_at }>

POST /api/cashflow/accounts
- Body:
  {
    "name": string,
    "type"?: string,
    "currency": string,
    "is_default"?: boolean
  }
- Response 200: { "success": true }

PUT /api/cashflow/accounts
- Body: same as POST + { "id": string }
- Response 200: { "success": true }

DELETE /api/cashflow/accounts
- Body: { "id": string }
- Response 200: { "success": true }

GET /api/cashflow/categories
- Response 200: Array<{ id, name, type, parent_id, level, is_default, category_focus, created_at }>

POST /api/cashflow/categories
- Body:
  {
    "name": string,
    "type": "expense" | "income" | "transfer",
    "parent_id"?: string | null,
    "level": 0 | 1 | 2,
    "category_focus"?: "NE" | "SE" | "INV" | "EDU" | "ENJ" | "KHAC" | null
  }
- Response 200: { "success": true }
- Notes: transfer must be level 0 and parent_id null; child type must match parent type.

PUT /api/cashflow/categories
- Body: same as POST + { "id": string }
- Response 200: { "success": true }

DELETE /api/cashflow/categories
- Body: { "id": string, "cascade"?: boolean }
- Response 200: { "success": true }
- Notes: if has child categories and cascade is false, returns 400. If category has transactions, returns 400.

GET /api/cashflow/transactions
- Query: range=today|week|month|all (default: month)
- Response 200: Array<{
    id,
    type,
    amount,
    currency,
    note,
    transaction_time,
    category: { id, name, type } | null,
    account: { id, name, currency } | null
  }>
- Notes: default limit 50, order by transaction_time desc.

POST /api/cashflow/transactions
- Body:
  {
    "type"?: "expense" | "income" | "transfer",
    "amount": number,
    "category_id"?: string | null,
    "account_id"?: string | null,
    "note"?: string | null,
    "transaction_time"?: string (ISO),
    "currency"?: string
  }
- Response 200: same shape as GET item (inserted row with category/account)

PUT /api/cashflow/transactions
- Body: same as POST + { "id": string }
- Response 200: { "success": true }

DELETE /api/cashflow/transactions
- Body: { "id": string }
- Response 200: { "success": true }

GET /api/cashflow/report-transactions
- Response 200: Array<{
    id,
    type,
    amount,
    currency,
    note,
    transaction_time,
    category: { id, name, type } | null,
    account: { id, name, currency } | null
  }>
- Notes: returns from start of previous month to now.

Debts
GET /api/debts
- Query: status=ongoing|paid_off|overdue|cancelled
- Response 200: Array<{
    id,
    partner_id,
    direction,
    principal_amount,
    currency,
    start_date,
    due_date,
    interest_type,
    interest_rate,
    interest_cycle,
    status,
    description,
    created_at,
    updated_at,
    partner: { id, name, type, phone } | null,
    outstanding_principal: number
  }>

POST /api/debts
- Body:
  {
    "partner_id": string,
    "direction": "lend" | "borrow",
    "principal_amount": number,
    "currency"?: string,
    "start_date": string (ISO date),
    "due_date"?: string | null,
    "interest_type"?: "none" | "fixed" | "percent",
    "interest_rate"?: number | null,
    "interest_cycle"?: "day" | "month" | "year" | null,
    "description"?: string | null,
    "account_id"?: string | null,
    "category_id"?: string | null,
    "transaction_time"?: string (ISO datetime),
    "note"?: string | null
  }
- Response 200: { "success": true, "debt_id": string }
- Notes: creates a cashflow transaction + initial debt_payment.

POST /api/debts/payments
- Body:
  {
    "debt_id": string,
    "amount": number,
    "principal_amount"?: number | null,
    "interest_amount"?: number | null,
    "account_id"?: string | null,
    "category_id"?: string | null,
    "currency"?: string,
    "payment_date"?: string (ISO datetime),
    "note"?: string | null
  }
- Response 200: { "success": true, "remaining_principal": number }

GET /api/debts/partners
- Response 200: Array<{ id, name, type, phone, note, created_at }>

POST /api/debts/partners
- Body:
  { "name": string, "type"?: string | null, "phone"?: string | null, "note"?: string | null }
- Response 200: { "success": true }

PUT /api/debts/partners
- Body: same as POST + { "id": string }
- Response 200: { "success": true }

DELETE /api/debts/partners
- Body: { "id": string }
- Response 200: { "success": true }

Partners
GET /api/partners
- Response 200: Array<{ id, name, type, phone, note, created_at }>

POST /api/partners
- Body:
  { "name": string, "type"?: string | null, "phone"?: string | null, "note"?: string | null }
- Response 200: { "success": true }

PUT /api/partners
- Body: same as POST + { "id": string }
- Response 200: { "success": true }

DELETE /api/partners
- Body: { "id": string }
- Response 200: { "success": true }

POST /api/partners/transactions
- Body:
  {
    "partner_id": string,
    "direction": "lend" | "borrow" | "repay" | "receive",
    "amount": number,
    "principal_amount"?: number | null,
    "interest_amount"?: number | null,
    "account_id"?: string | null,
    "category_id"?: string | null,
    "currency"?: string,
    "date"?: string (ISO datetime),
    "note"?: string | null
  }
- Response 200: { "success": true, "transaction_id": string }

Report Runs
GET /api/report-runs
- Response 200: Array<{ id, type, report_date, note, created_at }>

POST /api/report-runs
- Body:
  { "type": "cashflow" | "trading" | "funding", "report_date"?: string (YYYY-MM-DD), "note"?: string | null }
- Response 200: { id, type, report_date, note, created_at }

PUT /api/report-runs
- Body:
  { "id": string, "type": "cashflow" | "trading" | "funding", "report_date": string (YYYY-MM-DD), "note"?: string | null }
- Response 200: { id, type, report_date, note, created_at }

DELETE /api/report-runs
- Body: { "id": string }
- Response 200: { "success": true }

Trading
GET /api/trading/funding
- Response 200: Array<{
    id,
    user_id,
    type,
    amount,
    currency,
    method,
    note,
    transaction_time,
    created_at,
    balance_account_id
  }>

POST /api/trading/funding
- Body:
  {
    "type": "deposit" | "withdraw",
    "amount": number,
    "currency": string,
    "method": string,
    "transaction_time": string (ISO),
    "note"?: string | null,
    "balance_account_id": string
  }
- Response 200: { "success": true }

PUT /api/trading/funding
- Body: same as POST + { "id": string }
- Response 200: { "success": true }

DELETE /api/trading/funding
- Body: { "id": string }
- Response 200: { "success": true }

GET /api/trading/balance-accounts
- Response 200: Array<{
    id,
    account_type,
    name,
    currency,
    is_active,
    created_at,
    broker,
    platform,
    account_number,
    is_demo,
    funding_accounts: Array<{ id, provider, note }> | null
  }>

POST /api/trading/balance-accounts
- Body:
  {
    "account_type"?: "TRADING" | "FUNDING",
    "name": string,
    "currency": string,
    "is_active"?: boolean,
    "broker"?: string | null,
    "platform"?: string | null,
    "account_number"?: string | null,
    "is_demo"?: boolean
  }
- Response 200: created balance account with same shape as GET item.

PUT /api/trading/balance-accounts
- Body: same as POST + { "id": string }
- Response 200: updated balance account with same shape as GET item (or { "success": true }).

DELETE /api/trading/balance-accounts
- Body: { "id": string }
- Response 200: { "success": true }
- Notes: soft-delete (is_active=false).

GET /api/trading/orders
- Query: symbol=string (ilike), status=open|closed|cancelled
- Response 200: Array<{
    id,
    user_id,
    symbol,
    side,
    entry_price,
    sl_price,
    tp_price,
    volume,
    leverage,
    status,
    open_time,
    close_time,
    close_price,
    pnl_amount,
    pnl_percent,
    note,
    created_at,
    ticket,
    original_position_size,
    commission_usd,
    swap_usd,
    equity_usd,
    margin_level,
    close_reason,
    balance_account_id,
    is_imported
  }>

POST /api/trading/orders
- Body:
  {
    "symbol": string,
    "side": "buy" | "sell",
    "entry_price": number,
    "sl_price"?: number,
    "tp_price"?: number,
    "volume": number,
    "leverage"?: number,
    "ticket"?: string | null,
    "original_position_size"?: number | null,
    "commission_usd"?: number | null,
    "swap_usd"?: number | null,
    "equity_usd"?: number | null,
    "margin_level"?: number | null,
    "close_reason"?: string | null,
    "balance_account_id": string,
    "status"?: "open" | "closed" | "cancelled",
    "open_time": string (ISO),
    "close_time"?: string,
    "close_price"?: number,
    "pnl_amount"?: number,
    "pnl_percent"?: number,
    "note"?: string | null
  }
- Response 200: { "success": true }

PUT /api/trading/orders
- Body: same as POST + { "id": string }
- Response 200: { "success": true }
- Notes: imported orders cannot be edited.

DELETE /api/trading/orders
- Body: { "id": string }
- Response 200: { "success": true }
- Notes: imported orders cannot be deleted.

POST /api/trading/orders/import
- Body:
  {
    "rows": Array<{
      "ticket"?: string | null,
      "symbol": string,
      "side": "buy" | "sell",
      "entry_price": number,
      "sl_price"?: number | null,
      "tp_price"?: number | null,
      "volume": number,
      "leverage"?: number | null,
      "original_position_size"?: number | null,
      "commission_usd"?: number | null,
      "swap_usd"?: number | null,
      "equity_usd"?: number | null,
      "margin_level"?: number | null,
      "close_reason"?: string | null,
      "status": "open" | "closed" | "cancelled",
      "open_time": string,
      "close_time"?: string | null,
      "close_price"?: number | null,
      "pnl_amount"?: number | null,
      "pnl_percent"?: number | null,
      "note"?: string | null,
      "balance_account_id": string
    }>
  }
- Response 200:
  { "success": true, "count": number, "skipped": number, "message"?: string }

POST /api/trading/orders/sync-ledger
- Body: none
- Response 200: { "synced": number, "skipped": number, "message"?: string }

Telegram
POST /api/telegram/webhook
- Headers: x-telegram-bot-api-secret-token: <TELEGRAM_WEBHOOK_SECRET>
- Body: Telegram Update payload
- Response 200: { "ok": true } (or 401/500 with { "error": string })
