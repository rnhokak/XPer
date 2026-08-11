-- Cashflow hierarchy and account type updates.
-- Adds account.type, categories parent/level, and constraints for 3-level hierarchy.

-- Add account type if missing
alter table if exists public.accounts
  add column if not exists type text;

-- Add parent/level to categories if missing
alter table if exists public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null,
  add column if not exists level smallint not null default 0 check (level in (0,1,2));

-- Ensure existing rows have level 0
update public.categories set level = 0 where level is null;

-- Optional: enforce parent/level relationship via constraints using check (limited)
-- Cannot enforce parent level strictly with simple check; enforce in application and triggers if desired.

create index if not exists categories_parent_idx on public.categories (user_id, parent_id);
