-- Updates category_focus values to new system: NE (Need) | SE (Save) | INV (Invest) | EDU (Education) | ENJ (Enjoy) | KHAC (Other)

-- First, update existing values to null to avoid constraint violations
update public.categories set category_focus = null where category_focus is not null and category_focus not in ('NE', 'SE', 'INV', 'EDU', 'ENJ', 'KHAC');

-- Then drop and recreate the constraint
alter table if exists public.categories
  drop constraint if exists categories_category_focus_check;

alter table if exists public.categories
  add constraint categories_category_focus_check
    check (category_focus is null or category_focus in ('NE', 'SE', 'INV', 'EDU', 'ENJ', 'KHAC'));