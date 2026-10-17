-- Favourite listings: tap the heart on a listing to save it and find it again later.
-- Only you can see what you saved (the owner isn't told).

create table public.saved_listings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index saved_listings_listing_id_idx on public.saved_listings (listing_id);

alter table public.saved_listings enable row level security;

create policy "Users see their own saved listings"
on public.saved_listings for select
to authenticated
using ((select auth.uid()) = user_id);

-- You can only save listings you're allowed to see (active ones, or your own).
create policy "Users save listings for themselves"
on public.saved_listings for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.listings l where l.id = listing_id)
);

create policy "Users remove their own saved listings"
on public.saved_listings for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Spam limit, reusing the shared trigger from the launch-hardening migration.
create trigger saved_listings_rate_limit
before insert on public.saved_listings
for each row execute function public.enforce_rate_limit('200', '1 day', 'user_id');
