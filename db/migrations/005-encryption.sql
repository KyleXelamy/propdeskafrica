-- ============================================================
-- 005-encryption.sql
-- Blind-index columns for the encrypted PII columns.
-- Idempotent. Plain Postgres (Neon-compatible).
-- ============================================================
--
-- What this file does
--   Adds the sibling columns that hold the DETERMINISTIC BLIND INDEX of the
--   searchable, encrypted columns, plus the indexes that make the lookup
--   usable:
--
--     public.tenants            email_blind_index, phone_blind_index
--     public.user_profiles      phone_blind_index
--     public.mpesa_transactions phone_blind_index
--     public.c2b_transactions   msisdn_blind_index
--
--   A blind index is `HMAC-SHA256(blindKey, normalise(value))` rendered as
--   `<blindKeyId>:<hex>`, computed under the SEPARATE PROPDESK_BLIND_INDEX_KEYS
--   key. The encrypted value itself keeps living in the existing column
--   (tenants.national_id, tenants.phone, …) as a `v1:<iv>:<tag>:<ciphertext>`
--   envelope — this file adds columns, it does not move or rename any.
--
--   Why a blind index at all: the value column is encrypted with a fresh
--   random IV on every write, so it is not searchable and cannot be indexed.
--   The blind index keeps `WHERE phone_blind_index = $1` working without
--   giving up the randomised encryption. See audit/design/encryption-design.md
--   §9 (blind index) and §11.4 (the schema change).
--
-- Rules obeyed by this file
--   * ADDITIVE ONLY. No column is dropped, renamed or re-typed. No existing
--     constraint is touched. No `alter table … alter column … type`.
--   * `if not exists` everywhere, so the file can be applied more than once.
--   * No PII is written by this file. The backfill
--     (scripts/backfill-encryption.ts, npm run db:encrypt-backfill) fills the
--     new columns with the HMACs.
--   * c2b_transactions only exists on the Supabase-path database, so its
--     block is guarded with to_regclass() and is a no-op on a Neon-only
--     deployment.
--
-- Run with: npm run db:migrate   (applies every file in db/migrations in
-- order) — or paste the file into the Neon SQL editor / psql.
--
-- The repo's migration runner (lib/db/migrate.ts) is comment-aware: it
-- strips `--` comments instead of discarding the statement that followed
-- them, and it keeps `$$ … $$` function bodies intact. The statements below
-- are still written one per line, because that is also how they read in the
-- Neon SQL editor.
--
-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- 1) public.tenants ---------------------------------------------------------
-- tenants.email and tenants.phone are encrypted (randomised envelope) and
-- stay searchable through their blind index. Look them up with
--   where email_blind_index = $1          -- blindIndex(email)
--   where phone_blind_index = $1          -- blindIndex(normalizePhoneE164(phone))
alter table public.tenants add column if not exists email_blind_index text;
alter table public.tenants add column if not exists phone_blind_index text;
create index if not exists tenants_email_blind_index_idx on public.tenants (email_blind_index);
create index if not exists tenants_phone_blind_index_idx on public.tenants (phone_blind_index);

-- 2) public.mpesa_transactions ---------------------------------------------
-- The payer's MSISDN on an STK push. Same lookup shape as tenants.phone.
alter table public.mpesa_transactions add column if not exists phone_blind_index text;
create index if not exists mpesa_transactions_phone_blind_index_idx on public.mpesa_transactions (phone_blind_index);

-- 3) public.user_profiles ---------------------------------------------------
-- The landlord's own phone number (db/migrations/001-core.sql:38). Same
-- lookup shape as tenants.phone.
alter table public.user_profiles add column if not exists phone_blind_index text;
create index if not exists user_profiles_phone_blind_index_idx on public.user_profiles (phone_blind_index);

-- 4) public.c2b_transactions ------------------------------------------------
-- The payer's MSISDN on an incoming C2B payment. This table exists only on
-- the Supabase-path database (supabase-setup/10-holy-grail.sql:90-115), so the
-- block is guarded: on a Neon-only deployment it is a no-op instead of an
-- error. One statement, so the repo's line-based migration runner keeps it
-- intact.
do $$ begin if to_regclass('public.c2b_transactions') is not null then execute 'alter table public.c2b_transactions add column if not exists msisdn_blind_index text'; execute 'create index if not exists c2b_transactions_msisdn_blind_index_idx on public.c2b_transactions (msisdn_blind_index)'; end if; end $$;
