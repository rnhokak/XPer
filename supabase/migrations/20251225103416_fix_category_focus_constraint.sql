-- Fix constraint issue by ensuring all category_focus values are valid

-- First, update any remaining invalid values to null
update public.categories set category_focus = null where category_focus is not null and category_focus not in ('NE', 'SE', 'INV', 'EDU', 'ENJ', 'KHAC');

-- Verify the constraint exists and is correct
alter table if exists public.categories
  drop constraint if exists categories_category_focus_check;

alter table if exists public.categories
  add constraint categories_category_focus_check
    check (category_focus is null or category_focus in ('NE', 'SE', 'INV', 'EDU', 'ENJ', 'KHAC'));