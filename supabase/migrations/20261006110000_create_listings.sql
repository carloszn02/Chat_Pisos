-- Listings: "offering a room", "looking for a room" or "renting a whole flat".
-- A user can have any number of listings at the same time (no fixed user roles).
-- Listings can also be shared in district group chats, where they show as a card.

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null check (type in ('offering_room', 'seeking_room', 'whole_flat')),
  -- Districts (rows of chat_groups). Rooms and flats have exactly one; people looking can pick up to 3.
  district_ids uuid[] not null check (cardinality(district_ids) between 1 and 3),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text check (char_length(description) <= 2000),
  -- Monthly rent in euros; for "looking for a room" it's the maximum budget.
  price_eur integer not null check (price_eur between 1 and 20000),
  available_from date not null,
  min_stay_months integer check (min_stay_months between 1 and 36),
  bills_included boolean,
  furnished boolean,
  room_size_m2 integer check (room_size_m2 between 1 and 500),
  flatmates integer check (flatmates between 0 and 20),
  bedrooms integer check (bedrooms between 1 and 20),
  photo_urls text[] not null default '{}' check (cardinality(photo_urls) <= 10),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type = 'seeking_room' or cardinality(district_ids) = 1)
);

create index listings_status_created_at_idx on public.listings (status, created_at desc);
create index listings_user_id_idx on public.listings (user_id);
create index listings_district_ids_idx on public.listings using gin (district_ids);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

alter table public.listings enable row level security;

-- Everyone logged in sees active listings (except from people they blocked); owners always see their own.
create policy "View active listings and your own"
on public.listings for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    status = 'active'
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = listings.user_id
    )
  )
);

create policy "Users can create their own listings"
on public.listings for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own listings"
on public.listings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own listings"
on public.listings for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Group chat messages can carry a listing card.
alter table public.group_messages
add column listing_id uuid references public.listings (id) on delete set null;

-- Reports can be about a listing.
alter table public.reports
add column listing_id uuid references public.listings (id) on delete set null;

-- Photos: public bucket, each user writes only inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

create policy "Users can upload their own listing photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete their own listing photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
