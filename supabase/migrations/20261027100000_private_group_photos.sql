-- A photo for each private group, like in WhatsApp. Any member can change or remove it,
-- and the chat shows "Ana changed the group photo".

------------------------------------------------------------------------------
-- 1. Storage: a public bucket with one folder per group (<group id>/...).
-- Only members of the group can add or delete files in its folder.
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-photos',
  'group-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- True when the current user is a member of the group whose folder this file is in.
create function public.is_member_of_group_folder(path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := (storage.foldername(path))[1];
begin
  -- Not a valid group id: no.
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1 from public.private_group_members m
    where m.group_id = folder::uuid and m.user_id = auth.uid() and m.status = 'member'
  );
end;
$$;

revoke execute on function public.is_member_of_group_folder(text) from public, anon;
grant execute on function public.is_member_of_group_folder(text) to authenticated;

create policy "Members can upload their group's photo"
on storage.objects for insert
to authenticated
with check (bucket_id = 'group-photos' and public.is_member_of_group_folder(name));

create policy "Members can delete their group's photo"
on storage.objects for delete
to authenticated
using (bucket_id = 'group-photos' and public.is_member_of_group_folder(name));

------------------------------------------------------------------------------
-- 2. The photo on the group, changed only through set_private_group_photo().
------------------------------------------------------------------------------

alter table public.private_groups
  add column photo_url text,
  -- Must be a file in this group's own folder.
  add constraint private_groups_photo_from_storage check (
    photo_url is null
    or photo_url like public.app_storage_url() || 'group-photos/' || id::text || '/%'
  );

alter table public.private_group_messages drop constraint private_group_messages_event_check;
alter table public.private_group_messages
  add constraint private_group_messages_event_check
  check (event in ('created', 'joined', 'left', 'removed', 'requested', 'accepted', 'photo'));

-- Sets (or with null, removes) the group photo and leaves a notice in the chat.
create function public.set_private_group_photo(target_group uuid, new_photo_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.my_private_group_status(target_group) is distinct from 'member' then
    raise exception 'not_a_member';
  end if;
  update public.private_groups set photo_url = new_photo_url where id = target_group;
  insert into public.private_group_messages (group_id, sender_id, body, kind, event)
  values (target_group, auth.uid(), '', 'event', 'photo');
end;
$$;

revoke execute on function public.set_private_group_photo(uuid, text) from public, anon;
grant execute on function public.set_private_group_photo(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- 3. The photo in the Messages list and on invite links.
------------------------------------------------------------------------------

drop function public.my_private_groups();

create function public.my_private_groups()
returns table (
  id uuid,
  name text,
  my_status text,
  my_role text,
  invited_by uuid,
  member_count integer,
  last_message_body text,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  last_message_deleted boolean,
  last_message_kind text,
  last_message_event text,
  last_message_subject_id uuid,
  unread_count integer,
  pending_requests integer,
  invite_link_enabled boolean,
  photo_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    g.name,
    me.status,
    me.role,
    me.invited_by,
    (select count(*)::integer from public.private_group_members m where m.group_id = g.id and m.status = 'member'),
    last_message.body,
    last_message.sender_id,
    last_message.created_at,
    last_message.deleted_at is not null,
    last_message.kind,
    last_message.event,
    last_message.subject_id,
    case when me.status = 'member' then (
      select count(*)::integer
      from public.private_group_messages pm
      where pm.group_id = g.id
        and pm.kind = 'message'
        and pm.sender_id <> auth.uid()
        and pm.deleted_at is null
        and pm.created_at > me.last_read_at
    ) else 0 end,
    case when me.status = 'member' then (
      select count(*)::integer from public.private_group_join_requests(g.id)
    ) else 0 end,
    g.invite_link_enabled,
    g.photo_url
  from public.private_group_members me
  join public.private_groups g on g.id = me.group_id
  left join lateral (
    select pm.body, pm.sender_id, pm.created_at, pm.deleted_at, pm.kind, pm.event, pm.subject_id
    from public.private_group_messages pm
    where pm.group_id = g.id
    order by pm.created_at desc
    limit 1
  ) last_message on true
  where me.user_id = auth.uid()
    and me.status in ('member', 'invited')
  order by coalesce(last_message.created_at, me.created_at) desc;
$$;

revoke execute on function public.my_private_groups() from public, anon;
grant execute on function public.my_private_groups() to authenticated;

drop function public.private_group_link_preview(text);

create function public.private_group_link_preview(link_token text)
returns table (
  group_id uuid,
  name text,
  member_ids uuid[],
  my_status text,
  is_full boolean,
  photo_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    array(
      select m.user_id from public.private_group_members m
      where m.group_id = g.id and m.status = 'member'
      order by m.created_at
    ),
    (select me.status from public.private_group_members me
     where me.group_id = g.id and me.user_id = auth.uid()),
    public.private_group_size(g.id) >= 10,
    g.photo_url
  from public.private_group_links l
  join public.private_groups g on g.id = l.group_id
  where l.token = link_token
    and (
      (g.invite_link_enabled and l.expires_at > now())
      or exists (
        select 1 from public.private_group_members me
        where me.group_id = g.id and me.user_id = auth.uid()
      )
    );
$$;

revoke execute on function public.private_group_link_preview(text) from public, anon;
grant execute on function public.private_group_link_preview(text) to authenticated;
