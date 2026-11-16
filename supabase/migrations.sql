-- Non-destructive updates for an existing UniNest database.
-- Fresh installs only need schema.sql, which already includes all of this.
-- Safe to run more than once.

-- 1. Add the Activity category to saved items.
alter table public.nest_egg_items drop constraint if exists nest_egg_items_folder_check;
alter table public.nest_egg_items add constraint nest_egg_items_folder_check
  check (folder in ('Notes', 'Assignments', 'Activity', 'Notices', 'Other'));

-- 2. Only @jecrcu.edu.in accounts may be created.
--    Raising inside this AFTER INSERT trigger aborts the sign-up transaction.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- 3. Group admins.
alter table public.group_members add column if not exists role text not null default 'member';
alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check
  check (role in ('admin', 'member'));

-- Existing groups: whoever created them becomes an admin.
update public.group_members gm
set role = 'admin'
from public.groups g
where g.id = gm.group_id
  and g.created_by = gm.user_id
  and gm.role <> 'admin';

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

-- New groups must start with their creator as admin.
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

revoke all on function public.is_group_admin(uuid) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.rotate_invite_code(uuid) from public;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- 4. Admin group settings: rename/college and locking the chat to admins.
alter table public.groups add column if not exists messages_locked boolean not null default false;

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

revoke all on function public.update_group_details(uuid, text, text) from public;
revoke all on function public.set_chat_locked(uuid, boolean) from public;
grant execute on function public.update_group_details(uuid, text, text) to authenticated;
grant execute on function public.set_chat_locked(uuid, boolean) to authenticated;

-- Chat is read-only for members while a group is locked.
drop policy if exists "messages insert own groups" on public.messages;
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
