-- Reporting and blocking users.
--
-- Blocking someone:
-- * hides their messages in group chats (only for the person who blocked),
-- * stops private messages in both directions and hides the conversation,
-- * prevents them from starting a new conversation with you.
-- Reports are stored for us to review in the Supabase dashboard; users can only create them.

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'scam', 'harassment', 'inappropriate', 'fake_profile', 'other')),
  details text check (char_length(details) <= 1000),
  -- What was reported, when it was a specific message (kept even if the message is deleted later).
  group_message_id uuid references public.group_messages (id) on delete set null,
  direct_message_id uuid references public.direct_messages (id) on delete set null,
  message_snapshot text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

comment on table public.reports is 'User reports, reviewed by the Chat Pisos team. Not readable from the app.';

alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "Users can see who they blocked"
on public.blocks for select
to authenticated
using ((select auth.uid()) = blocker_id);

create policy "Users can block others"
on public.blocks for insert
to authenticated
with check ((select auth.uid()) = blocker_id);

create policy "Users can unblock"
on public.blocks for delete
to authenticated
using ((select auth.uid()) = blocker_id);

create policy "Users can create reports"
on public.reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

-- True if either user has blocked the other. Runs with elevated rights because
-- users can't see blocks made by other people.
create function public.is_blocked_between(user1 uuid, user2 uuid)
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

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Group chats: hide messages from people I blocked.
drop policy "Logged-in users can read group messages" on public.group_messages;

create policy "Logged-in users can read group messages except from blocked users"
on public.group_messages for select
to authenticated
using (
  not exists (
    select 1 from public.blocks b
    where b.blocker_id = (select auth.uid())
      and b.blocked_id = group_messages.user_id
  )
);

-- Private messages: no sending when either person has blocked the other.
drop policy "Participants can send messages when allowed" on public.direct_messages;

create policy "Participants can send messages when allowed"
on public.direct_messages for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and exists (
    select 1 from public.conversations c
    where c.id = direct_messages.conversation_id
      and (select auth.uid()) in (c.user_a, c.user_b)
      and (c.status = 'accepted' or (c.status = 'pending' and c.created_by = (select auth.uid())))
      and not public.is_blocked_between(c.user_a, c.user_b)
  )
);

-- Starting a conversation: refused when either person has blocked the other.
create or replace function public.start_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  first_user uuid;
  second_user uuid;
  conversation uuid;
begin
  if me is null then
    raise exception 'Not logged in';
  end if;
  if other_user = me then
    raise exception 'You cannot message yourself';
  end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'User not found';
  end if;
  if public.is_blocked_between(me, other_user) then
    raise exception 'Messaging is not available with this user';
  end if;

  first_user := least(me, other_user);
  second_user := greatest(me, other_user);

  insert into public.conversations (user_a, user_b, created_by)
  values (first_user, second_user, me)
  on conflict (user_a, user_b) do nothing
  returning id into conversation;

  if conversation is null then
    select id into conversation
    from public.conversations
    where user_a = first_user and user_b = second_user;
  end if;

  return conversation;
end;
$$;

-- The inbox: same as before, but conversations with people I blocked are hidden.
create or replace function public.my_conversations()
returns table (
  id uuid,
  other_user_id uuid,
  status text,
  is_incoming_request boolean,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  unread_count integer
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
        and m.created_at > coalesce(
          case when c.user_a = auth.uid() then c.user_a_last_read_at else c.user_b_last_read_at end,
          '-infinity'::timestamptz
        )
    )
  from public.conversations c
  left join lateral (
    select m.body, m.sender_id, m.created_at
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
