-- Photos in chats (district groups, private chats and private groups).
--
-- * Photos live in a PRIVATE storage bucket. The app gets short-lived links for the
--   photos of chats you're allowed to read; nobody else can open them.
-- * Each photo is stored as  <sender id>/<chat kind>/<chat id>/<random name>.jpg
--   and a message can only point to a photo in its own sender's folder for that chat.
-- * In private chats, photos are only allowed once the request has been accepted
--   (no unsolicited photos from strangers).

------------------------------------------------------------------------------
-- 1. Storage
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-photos',
  'chat-photos',
  false,
  5242880, -- 5 MB (photos are shrunk on the phone first, usually to ~300 KB)
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Whether the current user may read (or, with for_upload, add) photos in a chat folder.
create function public.can_use_chat_photo(path text, for_upload boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := string_to_array(path, '/');
  me uuid := auth.uid();
  chat uuid;
begin
  if me is null or cardinality(parts) < 4 then
    return false;
  end if;
  if for_upload and parts[1] <> me::text then
    return false;
  end if;
  begin
    chat := parts[3]::uuid;
  exception when others then
    return false;
  end;

  if parts[2] = 'group' then
    -- District groups can be read by anyone logged in; only members post.
    return not for_upload
      or exists (select 1 from public.group_members where group_id = chat and user_id = me);
  elsif parts[2] = 'conversation' then
    return exists (
      select 1 from public.conversations c
      where c.id = chat
        and me in (c.user_a, c.user_b)
        and (not for_upload or c.status = 'accepted')
    );
  elsif parts[2] = 'private_group' then
    return public.my_private_group_status(chat) = 'member';
  end if;
  return false;
end;
$$;

revoke execute on function public.can_use_chat_photo(text, boolean) from public, anon;
grant execute on function public.can_use_chat_photo(text, boolean) to authenticated;

create policy "Chat members can see chat photos"
on storage.objects for select
to authenticated
using (bucket_id = 'chat-photos' and public.can_use_chat_photo(name, false));

create policy "Chat members can upload photos to their own folder"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-photos' and public.can_use_chat_photo(name, true));

create policy "Users can delete their own chat photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

------------------------------------------------------------------------------
-- 2. Messages can carry a photo (with its size, so the chat doesn't jump while loading)
------------------------------------------------------------------------------

alter table public.group_messages
  add column image_path text,
  add column image_width integer check (image_width between 1 and 10000),
  add column image_height integer check (image_height between 1 and 10000),
  add constraint group_messages_image_in_own_folder check (
    image_path is null
    or image_path like user_id::text || '/group/' || group_id::text || '/%'
  );

alter table public.direct_messages
  add column image_path text,
  add column image_width integer check (image_width between 1 and 10000),
  add column image_height integer check (image_height between 1 and 10000),
  add constraint direct_messages_image_in_own_folder check (
    image_path is null
    or image_path like sender_id::text || '/conversation/' || conversation_id::text || '/%'
  );

alter table public.private_group_messages
  add column image_path text,
  add column image_width integer check (image_width between 1 and 10000),
  add column image_height integer check (image_height between 1 and 10000),
  add constraint private_group_messages_image_in_own_folder check (
    image_path is null
    or image_path like sender_id::text || '/private_group/' || group_id::text || '/%'
  );

-- A photo message may have no text (or a caption of up to 2000 characters).
alter table public.group_messages drop constraint group_messages_body_check;
alter table public.group_messages
  add constraint group_messages_body_check check (
    deleted_at is not null
    or char_length(btrim(body)) between 1 and 2000
    or (image_path is not null and char_length(body) <= 2000)
  );

alter table public.direct_messages drop constraint direct_messages_body_check;
alter table public.direct_messages
  add constraint direct_messages_body_check check (
    deleted_at is not null
    or char_length(btrim(body)) between 1 and 2000
    or (image_path is not null and char_length(body) <= 2000)
  );

alter table public.private_group_messages drop constraint private_group_messages_body_check;
alter table public.private_group_messages
  add constraint private_group_messages_body_check check (
    kind = 'event'
    or deleted_at is not null
    or char_length(btrim(body)) between 1 and 2000
    or (image_path is not null and char_length(body) <= 2000)
  );

-- Private chats: no photos until the request is accepted.
create function public.direct_messages_photo_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_path is not null and not exists (
    select 1 from public.conversations
    where id = new.conversation_id and status = 'accepted'
  ) then
    raise exception 'photos_after_accept';
  end if;
  return new;
end;
$$;

revoke execute on function public.direct_messages_photo_rule() from public, anon, authenticated;

create trigger direct_messages_photo_rule
before insert on public.direct_messages
for each row execute function public.direct_messages_photo_rule();

------------------------------------------------------------------------------
-- 3. Deleting your own message also removes its photo from the message
--    (the app deletes the file itself first).
------------------------------------------------------------------------------

create or replace function public.delete_my_message(kind text, message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind = 'group' then
    update public.group_messages
    set body = '', listing_id = null, image_path = null, image_width = null,
        image_height = null, deleted_at = now()
    where id = message and user_id = auth.uid() and deleted_at is null;
  elsif kind = 'direct' then
    update public.direct_messages
    set body = '', listing_id = null, image_path = null, image_width = null,
        image_height = null, deleted_at = now()
    where id = message and sender_id = auth.uid() and deleted_at is null;
  elsif kind = 'private_group' then
    update public.private_group_messages
    set body = '', listing_id = null, image_path = null, image_width = null,
        image_height = null, deleted_at = now()
    where id = message and sender_id = auth.uid() and deleted_at is null;
  else
    raise exception 'Unknown message kind';
  end if;
end;
$$;

------------------------------------------------------------------------------
-- 4. Moderation: reports remember which photo they were about, and the team's
--    removal tool clears photos too. (To delete the file itself, open Storage ›
--    chat-photos in the dashboard and delete it there.)
------------------------------------------------------------------------------

alter table public.reports add column image_path text;

create or replace view public.moderation_reports
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
  r.id as report_id,
  r.image_path,
  -- Also show reports about private group messages (added with private groups).
  r.private_group_message_id
from public.reports r
where r.status = 'open'
order by r.created_at desc;

revoke all on public.moderation_reports from public, anon, authenticated;

create or replace function public.remove_group_message(message uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.group_messages
  set body = '', listing_id = null, image_path = null, image_width = null,
      image_height = null, deleted_at = now()
  where id = message;
$$;

revoke execute on function public.remove_group_message(uuid) from public, anon, authenticated;
