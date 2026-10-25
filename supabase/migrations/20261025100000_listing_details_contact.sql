-- More details on listings (who the room is for, the flat, rules, ideal flatmate, transport)
-- and optional contact details (Instagram, LinkedIn, phone/WhatsApp or another link).
--
-- Every new field is optional: empty means "not said".

------------------------------------------------------------------------------
-- 1. Listing details.
------------------------------------------------------------------------------

alter table public.listings
  -- Rooms: who the room is for ('any' = anyone). People looking: who is looking.
  add column gender text check (gender in ('female', 'male', 'any')),
  add column bathrooms integer check (bathrooms between 1 and 10),
  -- 0 = ground floor ("bajo").
  add column floor integer check (floor between 0 and 40),
  add column deposit_months integer check (deposit_months between 0 and 6),
  -- Roughly how much the bills are per month when they're not included.
  add column bills_estimate_eur integer check (bills_estimate_eur between 1 and 1000),
  -- Things the room or flat has. Keep this list in sync with LISTING_FEATURES in the app.
  add column features text[] not null default '{}' check (
    features <@ array[
      'private_bathroom', 'double_bed', 'desk', 'wardrobe', 'exterior', 'balcony',
      'lift', 'air_conditioning', 'heating', 'washing_machine', 'dishwasher', 'terrace',
      'wifi', 'cleaning'
    ]::text[]
  ),
  -- Rules. Empadronamiento = being able to register at the address.
  add column registration_allowed boolean,
  add column pets_allowed boolean,
  add column smoking_allowed boolean,
  add column couples_allowed boolean,
  -- Ideal flatmate (rooms only).
  add column age_min integer check (age_min between 18 and 99),
  add column age_max integer check (age_max between 18 and 99),
  add column ideal_occupation text check (ideal_occupation in ('students', 'workers')),
  -- Transport nearby. Keep the metro list in sync with METRO_LINES in the app.
  add column metro_lines text[] not null default '{}' check (
    cardinality(metro_lines) <= 6
    and metro_lines <@ array[
      'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11', 'L12', 'R',
      'ML1', 'ML2', 'ML3'
    ]::text[]
  ),
  add column metro_station text check (char_length(metro_station) <= 60),
  -- Buses, Cercanías… as free text, e.g. "Bus 27, 150 · Cercanías Sol".
  add column transport_notes text check (char_length(transport_notes) <= 150),
  -- Whether the owner added contact details (kept up to date by a trigger below).
  add column has_contact boolean not null default false,
  add constraint listings_age_range check (age_min is null or age_max is null or age_min <= age_max);

-- Filters: "for girls / boys", pets, empadronamiento, metro line.
create index listings_metro_lines_idx on public.listings using gin (metro_lines);

------------------------------------------------------------------------------
-- 2. Contact details, in their own table so they aren't sent with every listing.
-- Only the owner reads the table directly; everyone else asks get_listing_contact(),
-- which is limited per day so nobody can collect phone numbers in bulk.
------------------------------------------------------------------------------

create table public.listing_contacts (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  -- Just the username, without @.
  instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  linkedin text check (
    char_length(linkedin) <= 200 and linkedin ~ '^https://([a-z]{2,3}\.)?linkedin\.com/\S+$'
  ),
  -- International format, e.g. +34612345678.
  phone text check (phone ~ '^\+[0-9]{8,15}$'),
  -- The phone number also works on WhatsApp.
  phone_whatsapp boolean not null default false,
  other_link text check (char_length(other_link) <= 200 and other_link ~ '^https://\S+\.\S+$'),
  updated_at timestamptz not null default now(),
  check (coalesce(instagram, linkedin, phone, other_link) is not null),
  check (phone is not null or not phone_whatsapp)
);

create trigger listing_contacts_set_updated_at
before update on public.listing_contacts
for each row execute function public.set_updated_at();

alter table public.listing_contacts enable row level security;

create policy "Owners see their listings' contact details"
on public.listing_contacts for select
to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.user_id = (select auth.uid())
  )
);

create policy "Owners add contact details to their listings"
on public.listing_contacts for insert
to authenticated
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.user_id = (select auth.uid())
  )
);

create policy "Owners change their listings' contact details"
on public.listing_contacts for update
to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.user_id = (select auth.uid())
  )
);

create policy "Owners remove their listings' contact details"
on public.listing_contacts for delete
to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.user_id = (select auth.uid())
  )
);

-- Keeps listings.has_contact in step with the contact table.
create function public.listing_contacts_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.listings set has_contact = false where id = old.listing_id;
    return old;
  end if;
  update public.listings set has_contact = true where id = new.listing_id and not has_contact;
  return new;
end;
$$;

revoke execute on function public.listing_contacts_sync() from public, anon, authenticated;

create trigger listing_contacts_sync
after insert or update or delete on public.listing_contacts
for each row execute function public.listing_contacts_sync();

-- Nobody can switch has_contact on or off by hand (only the trigger above, which runs
-- with pg_trigger_depth() > 1).
create function public.listings_keep_has_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 then
    if tg_op = 'INSERT' then
      new.has_contact := false;
    else
      new.has_contact := old.has_contact;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.listings_keep_has_contact() from public, anon, authenticated;

create trigger listings_keep_has_contact
before insert or update on public.listings
for each row execute function public.listings_keep_has_contact();

-- Who looked at which listing's contact details, for the daily limit.
create table public.listing_contact_views (
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (viewer_id, listing_id)
);

create index listing_contact_views_viewer_viewed_at_idx
on public.listing_contact_views (viewer_id, viewed_at);

-- No policies: only get_listing_contact() uses this table.
alter table public.listing_contact_views enable row level security;

-- The contact details of a listing you can see. Opening a new listing's contact
-- counts towards a limit of 30 a day; looking again at one you already opened is free.
create function public.get_listing_contact(target uuid)
returns table (
  instagram text,
  linkedin text,
  phone text,
  phone_whatsapp boolean,
  other_link text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;

  select l.user_id into owner
  from public.listings l
  where l.id = target
    and (
      l.user_id = me
      or (l.status = 'active' and l.expires_at > now() and not public.is_blocked_between(me, l.user_id))
    );
  if owner is null then
    return;
  end if;

  if owner <> me
    and not exists (
      select 1 from public.listing_contact_views v
      where v.viewer_id = me and v.listing_id = target
    )
  then
    if (
      select count(*) from public.listing_contact_views v
      where v.viewer_id = me and v.viewed_at > now() - interval '1 day'
    ) >= 30 then
      raise exception 'contact_limit' using hint = 'Too many contacts opened today.';
    end if;
    insert into public.listing_contact_views (viewer_id, listing_id) values (me, target);
  end if;

  return query
  select c.instagram, c.linkedin, c.phone, c.phone_whatsapp, c.other_link
  from public.listing_contacts c
  where c.listing_id = target;
end;
$$;

revoke execute on function public.get_listing_contact(uuid) from public, anon;
grant execute on function public.get_listing_contact(uuid) to authenticated;
