-- Telegram integration tables for multi-user linking.
-- Safe to run multiple times thanks to IF NOT EXISTS guards.

create extension if not exists "pgcrypto";

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  username text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_links_user_unique unique (user_id),
  constraint telegram_links_telegram_unique unique (telegram_user_id)
);
create index if not exists telegram_links_user_idx on public.telegram_links (user_id);
create index if not exists telegram_links_telegram_idx on public.telegram_links (telegram_user_id);

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists telegram_link_codes_user_idx on public.telegram_link_codes (user_id);
create index if not exists telegram_link_codes_expires_idx on public.telegram_link_codes (expires_at desc);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_codes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_links' and policyname = 'select own telegram links'
  ) then
    create policy "select own telegram links" on public.telegram_links for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_links' and policyname = 'insert own telegram links'
  ) then
    create policy "insert own telegram links" on public.telegram_links for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_links' and policyname = 'update own telegram links'
  ) then
    create policy "update own telegram links" on public.telegram_links for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_links' and policyname = 'delete own telegram links'
  ) then
    create policy "delete own telegram links" on public.telegram_links for delete using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_link_codes' and policyname = 'select own telegram link codes'
  ) then
    create policy "select own telegram link codes" on public.telegram_link_codes for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_link_codes' and policyname = 'insert own telegram link codes'
  ) then
    create policy "insert own telegram link codes" on public.telegram_link_codes for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_link_codes' and policyname = 'update own telegram link codes'
  ) then
    create policy "update own telegram link codes" on public.telegram_link_codes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_link_codes' and policyname = 'delete own telegram link codes'
  ) then
    create policy "delete own telegram link codes" on public.telegram_link_codes for delete using (auth.uid() = user_id);
  end if;
end$$;
