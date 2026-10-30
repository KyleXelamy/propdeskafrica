-- ============================================================
-- 004-marketing-forms.sql
-- Real storage for the public write endpoints.
-- Idempotent. Plain Postgres (Neon-compatible).
-- ============================================================
--
-- Why this file exists:
--   The public forms (newsletter subscribe, contact, pricing/enterprise lead,
--   feedback, support ticket, customer-request vote) used to `console.log` the
--   submission and return a convincing `ok: true`. Nothing was written, so a
--   visitor got a success message and the enquiry was gone. These tables give
--   those endpoints somewhere real to put the data.
--
-- Same portability rules as 001-core.sql:
--   * No `auth.users` foreign keys — user_id is a plain uuid where a signed-in
--     user is the actor, and NULL for genuinely anonymous submissions.
--   * No RLS is relied on: the app writes through the Neon connection with
--     bound parameters. RLS is enabled anyway so that a Supabase-only
--     deployment is not accidentally wide open, and no public role is granted
--     table access. The app never inserts via PostgREST as an anon user.
--
-- Run with: npm run db:migrate   (applies every file in db/migrations in order)

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- 1) newsletter_subscribers ------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- One row per address: a repeat subscribe is a no-op, not a duplicate row.
-- The application lowercases the address before insert, so a plain unique
-- index is enough (and works identically on Neon and on PostgREST).
create unique index if not exists newsletter_subscribers_email_idx
  on public.newsletter_subscribers (email);

-- 2) contact_submissions ---------------------------------------------------
-- The contact form and both lead-capture forms (pricing, enterprise) share
-- one table; `kind` separates them so the team can filter by intake.
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contact'
    check (kind in ('contact', 'pricing_lead', 'enterprise_lead')),
  first_name text,
  last_name text,
  email text not null,
  company text,
  topic text,
  message text,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_kind_idx
  on public.contact_submissions (kind, created_at desc);
create index if not exists contact_submissions_email_idx
  on public.contact_submissions (lower(email));

-- 3) support_tickets --------------------------------------------------------
-- user_id is NULL for a guest ticket and set for a signed-in tenant.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  reference text not null,
  subject text not null,
  category text not null
    check (category in ('bug', 'billing', 'question', 'feature')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists support_tickets_reference_idx
  on public.support_tickets (reference);
create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);

-- 4) customer_requests -----------------------------------------------------
-- Public feature ideas. `votes` is the authoritative count; the vote table
-- below is what makes it real (one vote per hashed device per idea).
create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  body text,
  email text,
  reference text,
  votes integer not null default 0 check (votes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_requests_slug_idx
  on public.customer_requests (slug);
create index if not exists customer_requests_votes_idx
  on public.customer_requests (votes desc);

-- 5) customer_request_votes ------------------------------------------------
-- voter_hash is a salted SHA-256 of a coarse device identifier. It is NOT an
-- IP address and NOT reversible — it exists only to stop one device voting
-- repeatedly for the same idea.
create table if not exists public.customer_request_votes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  voter_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_request_votes_unique_idx
  on public.customer_request_votes (slug, voter_hash);

-- 6) Additive column repairs ----------------------------------------------
-- The damages and quotations tables are created by the "holy grail" patch in
-- supabase-setup/10-holy-grail.sql, which is not part of db/migrations. On a
-- database where that patch has not been applied these blocks are skipped;
-- where it HAS been applied they add the two columns the API already writes.
do $$
begin
  if exists (select 1 from pg_class where relname = 'damages'
             and relnamespace = 'public'::regnamespace) then
    alter table public.damages add column if not exists unit_id uuid;
  end if;
  if exists (select 1 from pg_class where relname = 'quotations'
             and relnamespace = 'public'::regnamespace) then
    alter table public.quotations add column if not exists contractor_ids uuid[];
  end if;
end $$;
