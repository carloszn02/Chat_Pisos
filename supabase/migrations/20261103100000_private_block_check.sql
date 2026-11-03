-- Two fixes from the Supabase security check.
--
-- 1. is_blocked_between(a, b) could be called by any logged-in person through the API with
--    any two people, which revealed whether two other people had blocked each other.
--    The real check moves to a "private" schema the API doesn't expose. The public function
--    keeps its name (rules and other functions use it) and, when someone calls it directly,
--    only answers about blocks that involve them. Database functions that run with full
--    rights (e.g. hiding a join request from someone a member blocked) still get the full
--    answer, since they don't run as the "authenticated" role.
-- 2. app_storage_url() gets a fixed search_path, like every other function.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_blocked_between(user1 uuid, user2 uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = user1 and blocked_id = user2)
       or (blocker_id = user2 and blocked_id = user1)
  );
$$;

revoke execute on function private.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;

-- Runs with the caller's rights, so current_user tells who is asking: a person through the
-- API or a row rule ("authenticated"/"anon"), or one of our own full-rights functions.
create or replace function public.is_blocked_between(user1 uuid, user2 uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when current_user in ('authenticated', 'anon')
      and (auth.uid() is null or auth.uid() not in (user1, user2))
      then false
    else private.is_blocked_between(user1, user2)
  end;
$$;

alter function public.app_storage_url() set search_path = '';
