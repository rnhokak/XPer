-- Allow transfer transactions by updating the type constraint.

alter table if exists public.transactions
  drop constraint if exists transactions_type_check;

alter table if exists public.transactions
  add constraint transactions_type_check check (type in ('income', 'expense', 'transfer'));
