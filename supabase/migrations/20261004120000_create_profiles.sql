-- User profiles: one row per user, created during onboarding (after sign-up).
-- Profiles are role-neutral: whether someone offers or seeks a room lives on
-- their listings, not here.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 50),
  birth_date date not null check (birth_date <= current_date - interval '18 years'),
  occupation text check (occupation in ('student', 'working', 'both')),
  languages text[] not null default '{}',
  about text check (char_length(about) <= 1000),
  avatar_url text,
  schedule text check (schedule in ('early_bird', 'night_owl')),
  tidiness text check (tidiness in ('very_tidy', 'relaxed')),
  smoking text check (smoking in ('non_smoker', 'outside_only', 'smoker')),
  pets text check (pets in ('have_pets', 'ok_with_pets', 'no_pets')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile of each user, visible to other logged-in users.';

-- Keep updated_at current on every change.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Row Level Security: without these policies nobody can read or write anything.
alter table public.profiles enable row level security;

create policy "Logged-in users can view profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Deleting a profile happens through account deletion (cascade from auth.users).
