-- Add "debt" category type and link partners to cashflow categories.

-- Allow debt in category type constraint
alter table if exists public.categories
  drop constraint if exists categories_type_check;

alter table if exists public.categories
  add constraint categories_type_check check (type in ('income', 'expense', 'transfer', 'debt'));

-- Link partners to a cashflow category
alter table if exists public.partners
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists partners_category_idx on public.partners (user_id, category_id);

-- Backfill debt root category + partner child categories
do $$
declare
  u record;
  p record;
  debt_root uuid;
  child_id uuid;
begin
  for u in select id from auth.users loop
    select id into debt_root
    from public.categories
    where user_id = u.id and type = 'debt' and level = 0 and parent_id is null
    limit 1;

    if debt_root is null then
      insert into public.categories (user_id, name, type, level)
      values (u.id, 'Debt', 'debt', 0)
      returning id into debt_root;
    end if;

    for p in select id, name, category_id from public.partners where user_id = u.id loop
      if p.category_id is null then
        select id into child_id
        from public.categories
        where user_id = u.id and type = 'debt' and parent_id = debt_root and name = p.name
        limit 1;

        if child_id is null then
          insert into public.categories (user_id, name, type, level, parent_id)
          values (u.id, p.name, 'debt', 1, debt_root)
          returning id into child_id;
        end if;

        update public.partners set category_id = child_id where id = p.id;
      end if;
    end loop;
  end loop;
end$$;

