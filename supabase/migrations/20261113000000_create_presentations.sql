-- One row per presentation, owned by the signed-in user.
-- Idempotent: safe to run even if the table was already created by hand.

create table if not exists public.presentations (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.presentations is 'Presenter Helper: one presentation (title, slides, settings) per row as JSON.';

-- Row-level security: users can only ever see and change their own rows,
-- even though the anon/publishable key is public.
alter table public.presentations enable row level security;

drop policy if exists "read own" on public.presentations;
drop policy if exists "insert own" on public.presentations;
drop policy if exists "update own" on public.presentations;
drop policy if exists "delete own" on public.presentations;

create policy "read own" on public.presentations
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "insert own" on public.presentations
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "update own" on public.presentations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "delete own" on public.presentations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-out visitors get no access at all.
revoke all on public.presentations from anon;
grant select, insert, update, delete on public.presentations to authenticated;
