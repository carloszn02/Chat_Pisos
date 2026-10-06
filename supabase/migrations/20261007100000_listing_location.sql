-- Map location for listings (rooms and whole flats).
--
-- Privacy: when the owner chooses "approximate area", the app moves the point by a
-- random ~200 m before saving, so the exact address is never stored or sent to anyone.
-- The street address is only kept when the owner chooses to show the exact location.

alter table public.listings
  add column latitude double precision,
  add column longitude double precision,
  add column location_exact boolean not null default false,
  add column address text check (char_length(address) <= 200);

alter table public.listings
  add constraint listings_location_complete
    check ((latitude is null) = (longitude is null)),
  -- Roughly the Community of Madrid, to catch mistakes like a pin in the sea.
  add constraint listings_location_in_madrid
    check (latitude is null or (latitude between 39.8 and 41.2 and longitude between -4.6 and -3.0)),
  add constraint listings_address_only_if_exact
    check (address is null or location_exact);
