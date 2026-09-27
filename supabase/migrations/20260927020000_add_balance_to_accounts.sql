-- Migration: Add balance field to accounts table (initial balance / starting money)
alter table if exists public.accounts
  add column if not exists balance numeric not null default 0;
