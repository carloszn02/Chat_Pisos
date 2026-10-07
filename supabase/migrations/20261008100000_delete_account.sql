-- Lets a user permanently delete their own account from inside the app
-- (required by Apple's App Store rules and by the GDPR "right to erasure").
--
-- Deleting the auth user removes their profile, and through "on delete cascade" every
-- row that belongs to them: group memberships and messages, private conversations and
-- messages, listings, blocks and reports. The app deletes their photo files first.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not logged in';
  end if;

  -- Any leftover files keep existing in storage, but must not block deleting the user.
  update storage.objects set owner = null where owner = me;

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
