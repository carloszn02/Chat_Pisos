-- Replies: a message can quote an earlier message from the same chat ("Responder").
-- If the original is deleted for good (e.g. its author deletes their account), the
-- reply stays and just loses its quote.

alter table public.group_messages
  add column reply_to_id uuid references public.group_messages (id) on delete set null;
alter table public.direct_messages
  add column reply_to_id uuid references public.direct_messages (id) on delete set null;
alter table public.private_group_messages
  add column reply_to_id uuid references public.private_group_messages (id) on delete set null;

-- The quoted message must be in the same chat (you can't quote another group's message).
create function public.check_reply_same_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  same_chat boolean;
begin
  if new.reply_to_id is null then
    return new;
  end if;
  if tg_table_name = 'group_messages' then
    select group_id = new.group_id into same_chat
    from public.group_messages where id = new.reply_to_id;
  elsif tg_table_name = 'direct_messages' then
    select conversation_id = new.conversation_id into same_chat
    from public.direct_messages where id = new.reply_to_id;
  else
    select group_id = new.group_id into same_chat
    from public.private_group_messages where id = new.reply_to_id;
  end if;
  if same_chat is distinct from true then
    raise exception 'reply_other_chat';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_reply_same_chat() from public, anon, authenticated;

create trigger group_messages_reply_same_chat
before insert on public.group_messages
for each row execute function public.check_reply_same_chat();

create trigger direct_messages_reply_same_chat
before insert on public.direct_messages
for each row execute function public.check_reply_same_chat();

create trigger private_group_messages_reply_same_chat
before insert on public.private_group_messages
for each row execute function public.check_reply_same_chat();
