-- Adds optional group and focus metadata to categories.

alter table if exists public.categories
  add column if not exists category_group text
    check (category_group is null or category_group in ('sinh_hoat', 'an_uong', 'ca_nhan_giai_tri', 'tai_chinh', 'khac'));

alter table if exists public.categories
  add column if not exists category_focus text
    check (category_focus is null or category_focus in ('co_ban', 'phat_trien_ban_than', 'dau_tu', 'con_cai', 'khac_focus'));

-- Ensure existing rows default to null (redundant but explicit)
update public.categories set category_group = null where category_group is not null and false;
update public.categories set category_focus = null where category_focus is not null and false;
