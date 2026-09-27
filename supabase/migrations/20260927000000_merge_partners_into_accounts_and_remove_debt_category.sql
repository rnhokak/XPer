-- Migration: Merge partners into accounts with type 'partner', remove partners table, remove debt and transfer categories.

-- 1. Migrate existing partners into accounts with type = 'partner'
insert into public.accounts (id, user_id, name, type, currency, is_default, created_at)
select p.id, p.user_id, p.name, 'partner', 'VND', false, coalesce(p.created_at, now())
from public.partners p
on conflict (id) do update set
  type = 'partner',
  name = excluded.name;

-- 2. Update foreign key on debts to reference accounts(id)
alter table if exists public.debts
  drop constraint if exists debts_partner_id_fkey;

alter table if exists public.debts
  add constraint debts_partner_id_fkey foreign key (partner_id) references public.accounts (id) on delete cascade;

-- 3. Drop partner_balances view and partner_transactions table
drop view if exists public.partner_balances cascade;
drop table if exists public.partner_transactions cascade;

-- 4. Drop partners table
drop table if exists public.partners cascade;

-- 5. Delete debt and transfer categories
delete from public.categories where type in ('debt', 'transfer');

-- 6. Restrict categories type check constraint to income and expense only
alter table if exists public.categories
  drop constraint if exists categories_type_check;

alter table if exists public.categories
  add constraint categories_type_check check (type in ('income', 'expense'));
