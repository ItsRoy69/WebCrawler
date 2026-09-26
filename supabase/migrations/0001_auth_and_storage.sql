-- WebCrawler — Supabase schema.
-- Run once in the Supabase SQL Editor. Idempotent, so re-running is safe.
--
-- Supabase Auth already owns users and passwords (bcrypt) in auth.users; we
-- never duplicate them. These tables hold application data only, scoped to an
-- auth user id and protected by row level security.

create extension if not exists "pgcrypto";

-- profiles: 1:1 mirror of auth.users
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text,
  avatar_url   text,
  provider     text not null default 'email',
  confirmed_at timestamptz,
  last_sign_in timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile data mirrored from auth.users. Passwords stay in auth.users and are never copied here.';

create index if not exists idx_profiles_email on public.profiles (lower(email));

-- search_history: per-user search queries
create table if not exists public.search_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  query        text not null check (char_length(query) between 1 and 512),
  domain       text,
  result_count integer not null default 0,
  response_ms  integer,
  created_at   timestamptz not null default now()
);

create index if not exists idx_search_history_user_time
  on public.search_history (user_id, created_at desc);

-- crawl_runs: per-user crawl jobs synced from the crawler
create table if not exists public.crawl_runs (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  target       text not null,
  host         text,
  status       text not null default 'queued',
  progress     integer not null default 0,
  pages_found  integer not null default 0,
  pages_stored integer not null default 0,
  message      text not null default '',
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists idx_crawl_runs_user_time
  on public.crawl_runs (user_id, created_at desc);

-- api_keys: developer keys for programmatic access.
-- Only a SHA-256 hash is stored; the plaintext is returned once, at creation.
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'default',
  key_prefix   text not null,
  key_hash     text not null unique,
  scopes       text[] not null default array['search', 'crawl']::text[],
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_api_keys_user on public.api_keys (user_id);

-- user_credentials: third-party secrets the user wants to keep.
-- Encrypted with pgp_sym_encrypt using a passphrase that never reaches
-- Postgres, so losing the passphrase loses the rows by design.
create table if not exists public.user_credentials (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  label        text not null,
  provider     text,
  username     text,
  ciphertext   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, label)
);

create index if not exists idx_user_credentials_user on public.user_credentials (user_id);

-- Encryption happens inside Postgres, so the plaintext is only ever in transit
-- and never lands in a table. The passphrase is WEBCRAWLER_CREDENTIAL_KEY.
-- SECURITY DEFINER keeps these callable through PostgREST /rpc.
create or replace function public.encrypt_credential(plaintext text, passphrase text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select pgp_sym_encrypt(plaintext, passphrase, 'cipher-algo=aes256');
$$;

create or replace function public.decrypt_ciphertext(ciphertext text, passphrase text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select pgp_sym_decrypt(ciphertext::bytea, passphrase);
$$;

revoke all on function public.encrypt_credential(text, text) from public, anon, authenticated;
revoke all on function public.decrypt_ciphertext(text, text) from public, anon, authenticated;
grant execute on function public.encrypt_credential(text, text) to service_role;
grant execute on function public.decrypt_ciphertext(text, text) to service_role;

-- Every policy is "auth.uid() = user_id", so a signed-in user can only read
-- or write their own rows. The backend uses the service role key, which
-- bypasses RLS; the browser uses the anon key and is fully constrained here.
alter table public.profiles        enable row level security;
alter table public.search_history  enable row level security;
alter table public.crawl_runs      enable row level security;
alter table public.api_keys        enable row level security;
alter table public.user_credentials enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "search_history: own rows" on public.search_history;
create policy "search_history: own rows" on public.search_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "crawl_runs: own rows" on public.crawl_runs;
create policy "crawl_runs: own rows" on public.crawl_runs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "api_keys: own rows" on public.api_keys;
create policy "api_keys: own rows" on public.api_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_credentials: own rows" on public.user_credentials;
create policy "user_credentials: own rows" on public.user_credentials
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create a profile row on signup (email, Google, GitHub all land in
-- auth.users).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, provider, confirmed_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(
      nullif(new.raw_app_meta_data ->> 'provider', ''),
      (select provider from auth.identities
        where user_id = new.id order by created_at limit 1)
    ),
    case
      when new.email_confirmed_at is not null then new.email_confirmed_at
      else null
    end
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for anyone who signed up before this migration ran.
insert into public.profiles (id, email, full_name, avatar_url, provider, confirmed_at)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  u.raw_user_meta_data ->> 'avatar_url',
  coalesce(
    nullif(u.raw_app_meta_data ->> 'provider', ''),
    (select provider from auth.identities where user_id = u.id order by created_at limit 1),
    'email'
  ),
  u.email_confirmed_at
from auth.users u
on conflict (id) do nothing;

-- Keep updated_at honest without every client having to remember it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists user_credentials_touch on public.user_credentials;
create trigger user_credentials_touch before update on public.user_credentials
  for each row execute function public.touch_updated_at();
