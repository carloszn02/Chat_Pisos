-- Privacy: other users must only see a person's age, never their exact date of birth.
--
-- * public.profiles: each user can read only their OWN row (with birth_date).
-- * public.public_profiles: what everyone else sees; age instead of birth_date.
-- * birth_date and id can no longer be changed after the profile is created.

drop policy "Logged-in users can view profiles" on public.profiles;

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

-- Only these columns can be edited; birth_date is fixed once set.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, occupation, languages, about, avatar_url, schedule, tidiness, smoking, pets)
on public.profiles to authenticated;

-- The view runs with its owner's rights so it can read all profiles, but only
-- exposes safe columns and is only available to logged-in users.
create view public.public_profiles
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
  created_at
from public.profiles;

comment on view public.public_profiles is 'Profiles as other users see them: age instead of date of birth.';

revoke all on public.public_profiles from anon, public;
grant select on public.public_profiles to authenticated;
