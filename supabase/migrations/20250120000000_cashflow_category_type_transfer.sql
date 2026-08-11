-- Allow transfer categories by updating the type constraint.

alter table if exists public.categories
  drop constraint if exists categories_type_check;

alter table if exists public.categories
  add constraint categories_type_check check (type in ('income', 'expense', 'transfer'));
