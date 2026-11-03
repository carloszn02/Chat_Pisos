-- Groups about a listing: "Ask with my flatmates".
--
-- From a listing, someone creates a private group with their future flatmates and invites the
-- person who published it. The group remembers its listing (shown pinned at the top), and the
-- listing is its first message. The publisher gets an ordinary group invitation: they see who
-- is asking and about which listing, and accept or decline. Nobody is added without saying yes.
--
-- Rules:
-- - Only active listings, never your own, and not when one of you blocked the other.
-- - Flatmates must be people you talk to (accepted private chat) or share a private group with.
-- - One group per listing per person: asking again opens the group you already have.
-- - A declined invitation is remembered, so that group can't invite the same person again
--   (this now applies to every private group). If the publisher declines, you can't ask them
--   about that listing again with a new group either.

alter table public.private_groups
  add column listing_id uuid references public.listings (id) on delete set null;

create index private_groups_listing_id_idx
  on public.private_groups (listing_id)
  where listing_id is not null;

create table public.private_group_declines (
  group_id uuid not null references public.private_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index private_group_declines_user_id_idx on public.private_group_declines (user_id);

-- Only the database functions below use it: no access through the API.
alter table public.private_group_declines enable row level security;
revoke all on public.private_group_declines from public, anon, authenticated;

-- A publisher's no to someone asking about their listing, kept even if that group is deleted.
create table public.listing_ask_declines (
  listing_id uuid not null references public.listings (id) on delete cascade,
  asker_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, asker_id)
);

create index listing_ask_declines_asker_id_idx on public.listing_ask_declines (asker_id);

alter table public.listing_ask_declines enable row level security;
revoke all on public.listing_ask_declines from public, anon, authenticated;

-- Declining an invitation is remembered.
create or replace function public.respond_to_group_invite(target_group uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if accept then
    update public.private_group_members
    set status = 'member', last_read_at = now()
    where group_id = target_group and user_id = auth.uid() and status = 'invited';
  else
    delete from public.private_group_members
    where group_id = target_group and user_id = auth.uid() and status = 'invited';
    if found then
      insert into public.private_group_declines (group_id, user_id)
      values (target_group, auth.uid())
      on conflict do nothing;
      -- The publisher declining a group about their listing: that person can't ask again.
      insert into public.listing_ask_declines (listing_id, asker_id)
      select g.listing_id, g.created_by
      from public.private_groups g
      join public.listings l on l.id = g.listing_id
      where g.id = target_group and l.user_id = auth.uid()
      on conflict do nothing;
    end if;
  end if;
end;
$$;

-- Inviting someone who already declined this group does nothing.
create or replace function public.add_private_group_invite(target_group uuid, inviter uuid, invitee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if invitee = inviter then
    return;
  end if;
  if not public.are_connected(inviter, invitee) then
    raise exception 'not_connected';
  end if;
  if public.is_blocked_between(inviter, invitee) then
    raise exception 'not_connected';
  end if;
  if exists (
    select 1 from public.private_group_declines
    where group_id = target_group and user_id = invitee
  ) then
    return;
  end if;
  if public.private_group_size(target_group) >= 10 then
    raise exception 'group_full';
  end if;

  insert into public.private_group_members (group_id, user_id, role, status, invited_by)
  values (target_group, invitee, 'member', 'invited', inviter)
  on conflict (group_id, user_id) do nothing;
end;
$$;

revoke execute on function public.add_private_group_invite(uuid, uuid, uuid) from public, anon, authenticated;

-- Whether two people are both members of some private group.
create function private.share_private_group(user1 uuid, user2 uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.private_group_members a
    join public.private_group_members b on b.group_id = a.group_id
    where a.user_id = user1 and a.status = 'member'
      and b.user_id = user2 and b.status = 'member'
  );
$$;

revoke execute on function private.share_private_group(uuid, uuid) from public, anon, authenticated;

create function public.ask_about_listing(target_listing uuid, flatmates uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  found_listing record;
  publisher uuid;
  new_group uuid;
  mate uuid;
begin
  if me is null then
    raise exception 'Not logged in';
  end if;

  select id, user_id, title, status, expires_at into found_listing
  from public.listings
  where id = target_listing;
  if found_listing.id is null
    or found_listing.status <> 'active'
    or found_listing.expires_at <= now() then
    raise exception 'listing_unavailable';
  end if;
  publisher := found_listing.user_id;
  if publisher = me then
    raise exception 'own_listing';
  end if;
  if public.is_blocked_between(me, publisher) then
    raise exception 'listing_unavailable';
  end if;

  -- Already asked about this listing: open that group.
  select g.id into new_group
  from public.private_groups g
  join public.private_group_members m
    on m.group_id = g.id and m.user_id = me and m.status = 'member'
  where g.listing_id = target_listing and g.created_by = me
  order by g.created_at desc
  limit 1;
  if new_group is not null then
    return new_group;
  end if;

  -- The publisher said no before: don't ask again with a new group.
  if exists (
    select 1 from public.listing_ask_declines
    where listing_id = target_listing and asker_id = me
  ) then
    raise exception 'publisher_declined';
  end if;

  -- You, up to 8 flatmates and the publisher: 10 people at most.
  if cardinality(array(
    select distinct f from unnest(coalesce(flatmates, '{}'::uuid[])) f
    where f <> me and f <> publisher
  )) > 8 then
    raise exception 'group_full';
  end if;

  insert into public.private_groups (name, created_by, listing_id)
  values (left(btrim(found_listing.title), 50), me, target_listing)
  returning id into new_group;

  insert into public.private_group_members (group_id, user_id, role, status)
  values (new_group, me, 'owner', 'member');

  foreach mate in array coalesce(flatmates, '{}'::uuid[]) loop
    if mate = me or mate = publisher then
      continue;
    end if;
    if public.is_blocked_between(me, mate)
      or not (public.are_connected(me, mate) or private.share_private_group(me, mate)) then
      raise exception 'not_connected';
    end if;
    insert into public.private_group_members (group_id, user_id, role, status, invited_by)
    values (new_group, mate, 'member', 'invited', me)
    on conflict (group_id, user_id) do nothing;
  end loop;

  insert into public.private_group_members (group_id, user_id, role, status, invited_by)
  values (new_group, publisher, 'member', 'invited', me)
  on conflict (group_id, user_id) do nothing;

  -- The listing is the first message, so it shows as a card in the chat.
  insert into public.private_group_messages (group_id, sender_id, body, listing_id)
  values (new_group, me, left(btrim(found_listing.title), 2000), target_listing);

  return new_group;
end;
$$;

revoke execute on function public.ask_about_listing(uuid, uuid[]) from public, anon;
grant execute on function public.ask_about_listing(uuid, uuid[]) to authenticated;
