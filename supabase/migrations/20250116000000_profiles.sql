-- Profiles table linked 1:1 with auth.users for display names and avatars.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_uidx on public.profiles (email);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'select own profile') then
    create policy "select own profile" on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'insert own profile') then
    create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'update own profile') then
    create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end$$;

-- Storage bucket for avatars (public read)
insert into storage.buckets (id, name, public) 
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = excluded.public;

-- Storage RLS: only owner can upload/update/delete paths matching their user id prefix
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Avatar images are publicly accessible') then
    create policy "Avatar images are publicly accessible" on storage.objects for select using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users can upload their own avatars') then
    create policy "Users can upload their own avatars" on storage.objects for insert with check (
      bucket_id = 'avatars' and auth.uid() = owner and position(auth.uid()::text || '/' in name) = 1
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users can update their own avatars') then
    create policy "Users can update their own avatars" on storage.objects for update using (
      bucket_id = 'avatars' and auth.uid() = owner and position(auth.uid()::text || '/' in name) = 1
    ) with check (
      bucket_id = 'avatars' and auth.uid() = owner and position(auth.uid()::text || '/' in name) = 1
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users can delete their own avatars') then
    create policy "Users can delete their own avatars" on storage.objects for delete using (
      bucket_id = 'avatars' and auth.uid() = owner and position(auth.uid()::text || '/' in name) = 1
    );
  end if;
end$$;
