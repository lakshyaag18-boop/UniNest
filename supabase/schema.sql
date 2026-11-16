-- UniNest schema for Supabase — account-based version with group admins.
--
-- WARNING: this resets the earlier prototype tables. Run it once in the Supabase
-- SQL editor (Project -> SQL Editor -> New query). Existing account-based
-- databases should run migrations.sql instead, which is non-destructive.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------- fresh start
drop table if exists public.nest_egg_items cascade;
drop table if exists public.messages cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.profiles cascade;
drop function if exists public.create_group(text, text);
drop function if exists public.join_group(text);
drop function if exists public.list_my_groups();
drop function if exists public.is_group_member(uuid);
drop function if exists public.is_group_admin(uuid);
drop function if exists public.remove_group_member(uuid, uuid);
drop function if exists public.rotate_invite_code(uuid);
drop function if exists public.update_group_details(uuid, text, text);
drop function if exists public.set_chat_locked(uuid, boolean);
drop function if exists public.handle_new_user();

-- ------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 32),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  college text,
  invite_code text not null unique,
  messages_locked boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_name text not null,
  body text,
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index messages_group_created_idx on public.messages (group_id, created_at);

create table public.nest_egg_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  group_name text,
  message_id uuid,
  folder text not null check (folder in ('Notes', 'Assignments', 'Activity', 'Notices', 'Other')),
  title text not null,
  body text,
  file_path text,
  file_name text,
  file_type text,
  saved_by text not null,
  sender_name text,
  source_created_at timestamptz,
  created_at timestamptz not null default now()
);

create index nest_egg_owner_idx on public.nest_egg_items (user_id, created_at desc);

-- Databases created before the Activity folder existed: widen the check constraint.
alter table public.nest_egg_items drop constraint if exists nest_egg_items_folder_check;
alter table public.nest_egg_items add constraint nest_egg_items_folder_check
  check (folder in ('Notes', 'Assignments', 'Activity', 'Notices', 'Other'));

-- ---------------------------------------------------------- helper fns
-- security definer so policies can check membership without recursing.
create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(target_group uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  )
  or exists (
    select 1
    from public.groups g
    where g.id = target_group
      and g.created_by = auth.uid()
  );
$$;

-- Creates the profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only college accounts may exist. Raising here aborts the sign-up.
  if new.email is null
     or split_part(lower(new.email), '@', 2) <> 'jecrcu.edu.in' then
    raise exception 'UniNest only accepts @jecrcu.edu.in college emails.'
      using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'student'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a group, generate a unique invite code and join it as admin.
create or replace function public.create_group(group_name text, group_college text default null)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  created_group public.groups;
  student_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(group_name, ''))) < 1 then
    raise exception 'Give the group a name.' using errcode = '22023';
  end if;

  select display_name into student_name from public.profiles where id = auth.uid();

  loop
    select string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32)::int + 1), 1),
             ''
           )
      into new_code
      from generate_series(1, 6);
    exit when not exists (select 1 from public.groups where invite_code = new_code);
  end loop;

  insert into public.groups (name, college, invite_code, created_by)
  values (
    btrim(group_name),
    nullif(btrim(coalesce(group_college, '')), ''),
    new_code,
    auth.uid()
  )
  returning * into created_group;

  insert into public.group_members (group_id, user_id, display_name, role)
  values (created_group.id, auth.uid(), coalesce(student_name, 'Student'), 'admin');

  return created_group;
end;
$$;

-- Join by invite code. The code is the only way to discover a group you are not in.
create or replace function public.join_group(code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.groups;
  student_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select * into target
  from public.groups
  where invite_code = upper(btrim(coalesce(code, '')));

  if target.id is null then
    raise exception 'No group found with that invite code.' using errcode = 'P0002';
  end if;

  select display_name into student_name from public.profiles where id = auth.uid();

  insert into public.group_members (group_id, user_id, display_name)
  values (target.id, auth.uid(), coalesce(student_name, 'Student'))
  on conflict (group_id, user_id) do update set display_name = excluded.display_name;

  return target;
end;
$$;

-- Remove somebody else from a group. Admins only; the creator cannot be removed.
create or replace function public.remove_group_member(target_group uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  creator uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not public.is_group_admin(target_group) then
    raise exception 'Only group admins can remove members.' using errcode = '42501';
  end if;

  select created_by into creator from public.groups where id = target_group;
  if target_user = creator then
    raise exception 'The group creator cannot be removed.' using errcode = '22023';
  end if;

  delete from public.group_members
  where group_id = target_group and user_id = target_user;
end;
$$;

-- Replace the invite code so the old one stops working. Admins only.
create or replace function public.rotate_invite_code(target_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not public.is_group_admin(target_group) then
    raise exception 'Only group admins can change the invite code.' using errcode = '42501';
  end if;

  loop
    select string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32)::int + 1), 1),
             ''
           )
      into new_code
      from generate_series(1, 6);
    exit when not exists (select 1 from public.groups where invite_code = new_code);
  end loop;

  update public.groups set invite_code = new_code where id = target_group;
  return new_code;
end;
$$;

-- Rename a group or change its college. Admins only.
create or replace function public.update_group_details(
  target_group uuid,
  new_name text,
  new_college text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.groups;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not public.is_group_admin(target_group) then
    raise exception 'Only group admins can change group settings.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(new_name, ''))) < 1 then
    raise exception 'Give the group a name.' using errcode = '22023';
  end if;

  update public.groups
  set name = btrim(new_name),
      college = nullif(btrim(coalesce(new_college, '')), '')
  where id = target_group
  returning * into updated;

  return updated;
end;
$$;

-- Lock or unlock the chat for members. Admins only.
create or replace function public.set_chat_locked(target_group uuid, locked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not public.is_group_admin(target_group) then
    raise exception 'Only group admins can change group settings.' using errcode = '42501';
  end if;

  update public.groups
  set messages_locked = coalesce(locked, false)
  where id = target_group;

  return coalesce(locked, false);
end;
$$;

create or replace function public.list_my_groups()
returns setof public.groups
language sql
security definer
set search_path = public
stable
as $$
  select g.*
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid()
  order by gm.joined_at desc;
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_admin(uuid) from public;
revoke all on function public.create_group(text, text) from public;
revoke all on function public.join_group(text) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.rotate_invite_code(uuid) from public;
revoke all on function public.update_group_details(uuid, text, text) from public;
revoke all on function public.set_chat_locked(uuid, boolean) from public;
revoke all on function public.list_my_groups() from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
grant execute on function public.update_group_details(uuid, text, text) to authenticated;
grant execute on function public.set_chat_locked(uuid, boolean) to authenticated;
grant execute on function public.list_my_groups() to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.messages enable row level security;
alter table public.nest_egg_items enable row level security;

-- profiles: only your own row
create policy "profiles read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- groups: only groups you belong to (the RPCs handle create/join/admin changes)
create policy "groups read own" on public.groups
  for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());

-- membership rows: your own, plus members of your groups.
-- Removing members happens through remove_group_member() only.
create policy "members read own or shared" on public.group_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));
create policy "members update own" on public.group_members
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages: read/write only inside your groups, always as yourself
create policy "messages read own groups" on public.messages
  for select to authenticated
  using (public.is_group_member(group_id));
create policy "messages insert own groups" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_group_member(group_id)
    and (
      public.is_group_admin(group_id)
      or not (select g.messages_locked from public.groups g where g.id = group_id)
    )
  );

-- nest egg: strictly per user
create policy "nest egg read own" on public.nest_egg_items
  for select to authenticated using (user_id = auth.uid());
create policy "nest egg insert own" on public.nest_egg_items
  for insert to authenticated with check (user_id = auth.uid());
create policy "nest egg update own" on public.nest_egg_items
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "nest egg delete own" on public.nest_egg_items
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------ storage
-- Private bucket. Files live under <group_id>/<file>. Only members of that group
-- may read, upload or delete, and the app uses short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do update set public = false;

drop policy if exists "chat files read" on storage.objects;
drop policy if exists "chat files upload" on storage.objects;
drop policy if exists "chat files delete" on storage.objects;

create policy "chat files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-files'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat files upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-files'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-files'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------- realtime
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;
