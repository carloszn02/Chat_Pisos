-- Richer profiles: more answers for the existing habits and new questions about living
-- together, so people can see how well they'd match as flatmates.
-- Every question is optional. Existing answers keep working (old option names are kept).

------------------------------------------------------------------------------
-- 1. More options for the existing habits.
------------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_schedule_check;
alter table public.profiles add constraint profiles_schedule_check
  check (schedule in ('early_bird', 'regular', 'night_owl'));

-- A 1-to-5 scale, from very relaxed to spotless.
alter table public.profiles drop constraint profiles_tidiness_check;
alter table public.profiles add constraint profiles_tidiness_check
  check (tidiness in ('very_relaxed', 'relaxed', 'normal', 'tidy', 'very_tidy'));

-- 'non_smoker' = doesn't smoke and prefers a smoke-free home.
alter table public.profiles drop constraint profiles_smoking_check;
alter table public.profiles add constraint profiles_smoking_check
  check (smoking in ('non_smoker', 'non_smoker_ok', 'outside_only', 'smoker'));

-- 'have_pets' = another kind of pet; 'no_pets' = prefers a home without pets.
alter table public.profiles drop constraint profiles_pets_check;
alter table public.profiles add constraint profiles_pets_check
  check (pets in ('have_dog', 'have_cat', 'have_pets', 'want_pet', 'ok_with_pets', 'no_pets'));

------------------------------------------------------------------------------
-- 2. New questions. Keep these lists in sync with src/types/profile.ts.
------------------------------------------------------------------------------

alter table public.profiles
  add column weekends text check (weekends in ('out', 'mixed', 'home')),
  add column work_from_home text check (work_from_home in ('never', 'some_days', 'every_day')),
  add column cooking text check (cooking in ('daily', 'sometimes', 'rarely')),
  add column diet text check (diet in ('anything', 'vegetarian', 'vegan')),
  add column guests text check (guests in ('rarely', 'sometimes', 'often')),
  add column overnight_guests text check (overnight_guests in ('never', 'sometimes', 'often')),
  add column noise text check (noise in ('quiet', 'moderate', 'lively')),
  add column social text check (social in ('together', 'sometimes', 'independent')),
  add column food_sharing text check (food_sharing in ('share', 'basics', 'separate')),
  add column interests text[] not null default '{}' check (
    cardinality(interests) <= 5
    and interests <@ array[
      'sports', 'gym', 'music', 'cinema', 'series', 'cooking', 'travel', 'gaming',
      'parties', 'reading', 'art', 'nature', 'technology', 'languages', 'photography', 'dancing'
    ]::text[]
  );

grant update (
  weekends, work_from_home, cooking, diet, guests, overnight_guests, noise, social,
  food_sharing, interests
) on public.profiles to authenticated;

------------------------------------------------------------------------------
-- 3. What other people see: the same view, with the new answers.
------------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = false)
as
select
  id,
  first_name,
  date_part('year', age(current_date, birth_date))::int as age,
  occupation,
  languages,
  about,
  avatar_url,
  schedule,
  tidiness,
  smoking,
  pets,
  created_at,
  weekends,
  work_from_home,
  cooking,
  diet,
  guests,
  overnight_guests,
  noise,
  social,
  food_sharing,
  interests
from public.profiles;

revoke all on public.public_profiles from anon, public;
grant select on public.public_profiles to authenticated;
