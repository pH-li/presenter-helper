-- Lets a signed-in user permanently delete their own account.
-- Deleting the auth.users row cascades to public.presentations (on delete cascade).
--
-- SECURITY DEFINER so it can delete from auth.users, which ordinary users
-- can't touch directly. It only ever deletes the caller's own row
-- (auth.uid()), and only signed-in users may call it.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from public.presentations where user_id = uid; -- explicit, in case the FK ever changes
  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_my_account() is 'Presenter Helper: permanently deletes the calling user and all their presentations.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
