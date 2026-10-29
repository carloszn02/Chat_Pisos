-- A message request is one message.
--
-- Until the other person accepts, the person who started the conversation can send a
-- single message (text or photo): the introduction. Accepting opens the chat for both.
-- Checked in a trigger that locks the conversation, so two messages sent at the same
-- moment can't both get through.

create function public.direct_messages_one_request_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_status text;
begin
  select c.status into conversation_status
  from public.conversations c
  where c.id = new.conversation_id
  for update;

  if conversation_status is distinct from 'accepted' and exists (
    select 1 from public.direct_messages m where m.conversation_id = new.conversation_id
  ) then
    raise exception 'request_already_sent';
  end if;
  return new;
end;
$$;

revoke execute on function public.direct_messages_one_request_message() from public, anon, authenticated;

create trigger direct_messages_one_request_message
before insert on public.direct_messages
for each row execute function public.direct_messages_one_request_message();
