-- Launch hardening: spam limits, keeping reports, photo address checks, listing expiry,
-- deleting your own messages, listing cards in private chats, and moderation tools.

------------------------------------------------------------------------------
-- 1. Spam limits
-- A shared trigger counts the user's recent rows and refuses new ones above a limit.
-- The app shows a friendly "slow down" message when it sees the 'rate_limit' error.
------------------------------------------------------------------------------

create function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_count integer := TG_ARGV[0]::integer;
  time_window interval := TG_ARGV[1]::interval;
  user_column text := TG_ARGV[2];
  author uuid;
  recent integer;
begin
  execute format('select ($1).%I', user_column) into author using new;
  execute format(
    'select count(*) from %I.%I where %I = $1 and created_at > now() - $2',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, user_column
  ) into recent using author, time_window;

  if recent >= max_count then
    raise exception 'rate_limit' using hint = 'Too many actions in a short time. Please wait a bit.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

-- Indexes so the counting stays fast.
create index group_messages_user_id_created_at_idx on public.group_messages (user_id, created_at);
create index direct_messages_sender_id_created_at_idx on public.direct_messages (sender_id, created_at);
create index conversations_created_by_created_at_idx on public.conversations (created_by, created_at);
create index listings_user_id_created_at_idx on public.listings (user_id, created_at);
create index reports_reporter_id_created_at_idx on public.reports (reporter_id, created_at);

create trigger group_messages_rate_limit
before insert on public.group_messages
for each row execute function public.enforce_rate_limit('30', '1 minute', 'user_id');

create trigger direct_messages_rate_limit
before insert on public.direct_messages
for each row execute function public.enforce_rate_limit('30', '1 minute', 'sender_id');

create trigger conversations_rate_limit
before insert on public.conversations
for each row execute function public.enforce_rate_limit('20', '1 day', 'created_by');

create trigger listings_rate_limit
before insert on public.listings
for each row execute function public.enforce_rate_limit('5', '1 day', 'user_id');

create trigger reports_rate_limit
before insert on public.reports
for each row execute function public.enforce_rate_limit('20', '1 day', 'reporter_id');

------------------------------------------------------------------------------
-- 2. Reports survive account deletion (so a scammer can't erase the evidence).
-- The IDs are kept as plain values; the reported person's name is saved at report time.
------------------------------------------------------------------------------

alter table public.reports drop constraint reports_reported_user_id_fkey;
alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports alter column reporter_id drop not null;
alter table public.reports add column reported_user_name text;

create function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select first_name into new.reported_user_name from public.profiles where id = new.reported_user_id;
  return new;
end;
$$;

revoke execute on function public.reports_before_insert() from public, anon, authenticated;

create trigger reports_before_insert
before insert on public.reports
for each row execute function public.reports_before_insert();

------------------------------------------------------------------------------
-- 3. Photos must come from our own storage, inside the owner's folder.
-- If you ever move to a new Supabase project, change the address below.
------------------------------------------------------------------------------

create function public.app_storage_url()
returns text
language sql
immutable
as $$
  select 'https://dtmfpgmfsuokehuuwsfz.supabase.co/storage/v1/object/public/'
$$;

create function public.photos_in_folder(urls text[], bucket text, owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(url like public.app_storage_url() || bucket || '/' || owner::text || '/%'), true)
  from unnest(urls) as url
$$;

-- "not valid": checked for every new or edited row, without failing on old test data.
alter table public.profiles
  add constraint profiles_avatar_from_storage
  check (avatar_url is null or public.photos_in_folder(array[avatar_url], 'avatars', id)) not valid;

alter table public.listings
  add constraint listings_photos_from_storage
  check (public.photos_in_folder(photo_urls, 'listing-photos', user_id)) not valid;

------------------------------------------------------------------------------
-- 4. Listings expire after 60 days unless renewed.
------------------------------------------------------------------------------

alter table public.listings
  add column expires_at timestamptz not null default now() + interval '60 days';

-- Nobody can set an expiry further than 60 days ahead (renewing resets it to 60 days).
create function public.listings_limit_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expires_at > now() + interval '60 days' then
    new.expires_at := now() + interval '60 days';
  end if;
  return new;
end;
$$;

create trigger listings_limit_expiry
before insert or update on public.listings
for each row execute function public.listings_limit_expiry();

drop policy "View active listings and your own" on public.listings;

create policy "View active listings and your own"
on public.listings for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (
    status = 'active'
    and expires_at > now()
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = listings.user_id
    )
  )
);

------------------------------------------------------------------------------
-- 5. Deleting your own messages.
-- The message stays as "Message deleted" (so replies still make sense) but its text is erased.
-- Reports keep their own copy of the reported text.
------------------------------------------------------------------------------

alter table public.group_messages add column deleted_at timestamptz;
alter table public.direct_messages add column deleted_at timestamptz;

alter table public.group_messages drop constraint group_messages_body_check;
alter table public.group_messages
  add constraint group_messages_body_check
  check (deleted_at is not null or char_length(btrim(body)) between 1 and 2000);

alter table public.direct_messages drop constraint direct_messages_body_check;
alter table public.direct_messages
  add constraint direct_messages_body_check
  check (deleted_at is not null or char_length(btrim(body)) between 1 and 2000);

create function public.delete_my_message(kind text, message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind = 'group' then
    update public.group_messages
    set body = '', listing_id = null, deleted_at = now()
    where id = message and user_id = auth.uid() and deleted_at is null;
  elsif kind = 'direct' then
    update public.direct_messages
    set body = '', listing_id = null, deleted_at = now()
    where id = message and sender_id = auth.uid() and deleted_at is null;
  else
    raise exception 'Unknown message kind';
  end if;
end;
$$;

revoke execute on function public.delete_my_message(text, uuid) from public, anon;
grant execute on function public.delete_my_message(text, uuid) to authenticated;

------------------------------------------------------------------------------
-- 6. Private messages can carry a listing card ("Talking about: Room in Calle Pez").
------------------------------------------------------------------------------

alter table public.direct_messages
  add column listing_id uuid references public.listings (id) on delete set null;

-- The inbox preview should say "Message deleted" rather than show an empty text.
-- (Its result columns change, so the old version is removed first.)
drop function public.my_conversations();

create function public.my_conversations()
returns table (
  id uuid,
  other_user_id uuid,
  status text,
  is_incoming_request boolean,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  unread_count integer,
  last_message_deleted boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end,
    case when c.status = 'declined' then 'pending' else c.status end,
    c.status = 'pending' and c.created_by <> auth.uid(),
    last_message.body,
    last_message.sender_id,
    last_message.created_at,
    (
      select count(*)::integer
      from public.direct_messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.deleted_at is null
        and m.created_at > coalesce(
          case when c.user_a = auth.uid() then c.user_a_last_read_at else c.user_b_last_read_at end,
          '-infinity'::timestamptz
        )
    ),
    last_message.deleted_at is not null
  from public.conversations c
  left join lateral (
    select m.body, m.sender_id, m.created_at, m.deleted_at
    from public.direct_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_message on true
  where auth.uid() in (c.user_a, c.user_b)
    and (c.status <> 'declined' or c.created_by = auth.uid())
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = auth.uid()
        and b.blocked_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
    )
  order by coalesce(last_message.created_at, c.created_at) desc;
$$;

revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- Deleted group messages don't count as unread either.
create or replace function public.my_group_unread_counts()
returns table (group_id uuid, unread_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.group_id,
    (
      select count(*)::integer
      from public.group_messages g
      where g.group_id = m.group_id
        and g.user_id <> auth.uid()
        and g.deleted_at is null
        and g.created_at > m.last_read_at
    )
  from public.group_members m
  where m.user_id = auth.uid();
$$;

------------------------------------------------------------------------------
-- 7. Moderation tools, for the Chat Pisos team only.
-- Run them from the Supabase dashboard (SQL Editor); the app can't call them.
--   select * from public.moderation_reports;           -- open reports, newest first
--   select public.remove_group_message('<message id>');
--   select public.remove_listing('<listing id>');
--   select public.ban_user('<user id>');               -- also hides their listings
--   select public.unban_user('<user id>');
------------------------------------------------------------------------------

create view public.moderation_reports
with (security_invoker = true)
as
select
  r.created_at,
  r.reason,
  r.details,
  r.reported_user_name,
  r.reported_user_id,
  r.message_snapshot,
  r.group_message_id,
  r.direct_message_id,
  r.listing_id,
  r.status,
  r.id as report_id
from public.reports r
where r.status = 'open'
order by r.created_at desc;

revoke all on public.moderation_reports from public, anon, authenticated;

create function public.remove_group_message(message uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_messages
  set body = '', listing_id = null, deleted_at = now()
  where id = message;
$$;

create function public.remove_listing(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listings set status = 'closed' where id = target;
$$;

-- Blocks log-in (Supabase refuses banned accounts) and closes their listings.
create function public.ban_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users set banned_until = 'infinity' where id = target;
  update public.listings set status = 'closed' where user_id = target;
end;
$$;

create function public.unban_user(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update auth.users set banned_until = null where id = target;
$$;

revoke execute on function public.remove_group_message(uuid) from public, anon, authenticated;
revoke execute on function public.remove_listing(uuid) from public, anon, authenticated;
revoke execute on function public.ban_user(uuid) from public, anon, authenticated;
revoke execute on function public.unban_user(uuid) from public, anon, authenticated;
