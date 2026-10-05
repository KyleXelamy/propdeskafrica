-- ============================================================
-- 04-property-photos.sql
-- Property image gallery (multi-image per property)
-- ============================================================

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  file_url text not null,
  caption text,
  display_order integer not null default 0,
  is_cover boolean not null default false,
  uploaded_at timestamptz not null default now()
);

create index if not exists property_photos_property_id_idx
  on public.property_photos (property_id, display_order);

create index if not exists property_photos_user_id_idx
  on public.property_photos (user_id);

alter table public.property_photos enable row level security;

drop policy if exists "property_photos_select_own" on public.property_photos;
create policy "property_photos_select_own" on public.property_photos
  for select using (auth.uid() = user_id);

drop policy if exists "property_photos_insert_own" on public.property_photos;
create policy "property_photos_insert_own" on public.property_photos
  for insert with check (auth.uid() = user_id);

drop policy if exists "property_photos_update_own" on public.property_photos;
create policy "property_photos_update_own" on public.property_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "property_photos_delete_own" on public.property_photos;
create policy "property_photos_delete_own" on public.property_photos
  for delete using (auth.uid() = user_id);

-- Convenience view that returns the cover photo URL per property, so list
-- pages can join cheaply.
create or replace view public.property_cover_photo as
select distinct on (property_id)
  property_id,
  file_url as cover_url
from public.property_photos
where is_cover = true
order by property_id, display_order asc;

grant select on public.property_cover_photo to authenticated;
