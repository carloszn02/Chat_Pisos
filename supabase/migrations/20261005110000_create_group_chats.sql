-- District group chats.
-- * chat_groups: one row per group (Madrid-wide + popular districts). Managed by us, read-only for users.
-- * group_members: which users have joined which groups.
-- * group_messages: the messages. Any logged-in user can read a group; only members can write.

create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_code text not null check (char_length(short_code) between 1 and 3),
  is_city_wide boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index group_messages_group_id_created_at_idx
on public.group_messages (group_id, created_at desc);

-- Row Level Security --------------------------------------------------------

alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create policy "Logged-in users can view groups"
on public.chat_groups for select
to authenticated
using (true);

create policy "Users can see their own memberships"
on public.group_members for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can join groups"
on public.group_members for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can leave groups"
on public.group_members for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Logged-in users can read group messages"
on public.group_messages for select
to authenticated
using (true);

create policy "Members can send messages as themselves"
on public.group_messages for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.group_members m
    where m.group_id = group_messages.group_id
      and m.user_id = (select auth.uid())
  )
);

-- Messages can't be edited; deleting is added later together with moderation.

-- Live updates: new messages are pushed to open chats.
alter publication supabase_realtime add table public.group_messages;

-- Launch groups: Madrid-wide plus the 10 popular areas -----------------------

insert into public.chat_groups (slug, name, short_code, is_city_wide, sort_order) values
  ('madrid', 'Madrid · General', 'MA', true, 0),
  ('malasana', 'Malasaña', 'ML', false, 1),
  ('lavapies', 'Lavapiés', 'LV', false, 2),
  ('chamberi', 'Chamberí', 'CH', false, 3),
  ('arguelles-moncloa', 'Argüelles & Moncloa', 'AM', false, 4),
  ('chueca', 'Chueca', 'CU', false, 5),
  ('la-latina', 'La Latina', 'LL', false, 6),
  ('salamanca', 'Salamanca', 'SA', false, 7),
  ('retiro', 'Retiro', 'RE', false, 8),
  ('tetuan', 'Tetuán', 'TE', false, 9),
  ('arganzuela', 'Arganzuela', 'AZ', false, 10);
