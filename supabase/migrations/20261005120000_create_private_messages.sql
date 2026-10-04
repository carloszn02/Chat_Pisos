-- Private 1-to-1 messages with a "message requests" box.
--
-- A conversation starts as 'pending': the person who started it can write, and the
-- other person sees it under Message requests. Once they accept, both can write.
-- If they decline, the starter can't send more (and isn't told it was declined).
--
-- Conversations are created and updated only through the functions below, which
-- check every rule; users can't insert or edit conversation rows directly.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- The two participants, stored in a fixed order so each pair has one conversation.
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  user_a_last_read_at timestamptz,
  user_b_last_read_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b),
  check (created_by in (user_a, user_b))
);

create index conversations_user_b_idx on public.conversations (user_b);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index direct_messages_conversation_id_created_at_idx
on public.direct_messages (conversation_id, created_at desc);

-- Row Level Security --------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;

create policy "Participants can view their conversations"
on public.conversations for select
to authenticated
using ((select auth.uid()) in (user_a, user_b));

create policy "Participants can read messages"
on public.direct_messages for select
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = direct_messages.conversation_id
      and (select auth.uid()) in (c.user_a, c.user_b)
  )
);

-- Accepted: both can write. Pending: only the person who started it.
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
  )
);

-- Keep last_message_at current, so inboxes can be sorted.
create function public.direct_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger direct_messages_after_insert
after insert on public.direct_messages
for each row execute function public.direct_messages_after_insert();

-- Functions the app calls ---------------------------------------------------

-- Opens (or finds) the conversation with another user and returns its id.
create function public.start_conversation(other_user uuid)
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

-- The receiver of a request accepts or declines it.
create function public.respond_to_request(conversation uuid, accept boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversations
  set status = case when accept then 'accepted' else 'declined' end
  where id = conversation
    and status = 'pending'
    and created_by <> auth.uid()
    and auth.uid() in (user_a, user_b);
$$;

-- Marks everything in a conversation as read for the current user.
create function public.mark_conversation_read(conversation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversations
  set user_a_last_read_at = case when user_a = auth.uid() then now() else user_a_last_read_at end,
      user_b_last_read_at = case when user_b = auth.uid() then now() else user_b_last_read_at end
  where id = conversation
    and auth.uid() in (user_a, user_b);
$$;

-- The inbox: every conversation of the current user with its latest message and unread count.
-- A declined request disappears for the person who declined it, and still looks
-- pending to the person who sent it.
create function public.my_conversations()
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
  order by coalesce(last_message.created_at, c.created_at) desc;
$$;

revoke execute on function public.start_conversation(uuid) from public, anon;
revoke execute on function public.respond_to_request(uuid, boolean) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.direct_messages_after_insert() from public, anon, authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.respond_to_request(uuid, boolean) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;

-- Live updates for open chats and the inbox.
alter publication supabase_realtime add table public.direct_messages, public.conversations;
