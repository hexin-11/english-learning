-- 在 Supabase Dashboard > SQL Editor 中运行本文件。
-- 每个用户只有一行同步快照，并且只能访问自己的数据。

create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"schemaVersion":1,"entries":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

revoke all on table public.user_snapshots from anon;
grant select, insert, update, delete on table public.user_snapshots to authenticated;

drop policy if exists "Users can read their own snapshot" on public.user_snapshots;
create policy "Users can read their own snapshot"
on public.user_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own snapshot" on public.user_snapshots;
create policy "Users can create their own snapshot"
on public.user_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own snapshot" on public.user_snapshots;
create policy "Users can update their own snapshot"
on public.user_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own snapshot" on public.user_snapshots;
create policy "Users can delete their own snapshot"
on public.user_snapshots
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_user_snapshot_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_user_snapshot_updated_at() from public, anon, authenticated;

drop trigger if exists set_user_snapshot_updated_at on public.user_snapshots;
create trigger set_user_snapshot_updated_at
before update on public.user_snapshots
for each row
execute function public.set_user_snapshot_updated_at();

-- 账号角色：普通用户只能管理自己的学习快照，管理员可发布全站公共课程。
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  owns_private_lessons boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists owns_private_lessons boolean not null default false;

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

revoke all on function public.sync_auth_user_profile() from public, anon, authenticated;

drop trigger if exists sync_auth_user_profile on auth.users;
create trigger sync_auth_user_profile
after insert or update of email on auth.users
for each row
execute function public.sync_auth_user_profile();

-- 为启用角色系统之前已经注册的账号补建资料。
insert into public.profiles (user_id, email)
select id, email
from auth.users
on conflict (user_id) do update
  set email = excluded.email,
      updated_at = now();

-- Keep lessons 1-5 attached to this user even if the login email is changed later.
update public.profiles
set owns_private_lessons = true,
    updated_at = now()
where lower(email) = 'hexin20021111@gmail.com';

revoke all on table public.profiles from anon;
grant select, update on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile and admins can read all" on public.profiles;
create policy "Users can read their own profile and admins can read all"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "Only admins can update roles" on public.profiles;
create policy "Only admins can update roles"
on public.profiles
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- 全站公共内容。普通访客可读取，只有管理员可以发布或删除。
create table if not exists public.site_content (
  content_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

revoke all on table public.site_content from anon, authenticated;
grant select on table public.site_content to anon, authenticated;
grant insert, update, delete on table public.site_content to authenticated;

drop policy if exists "Public content is readable by everyone" on public.site_content;
create policy "Public content is readable by everyone"
on public.site_content
for select
to anon, authenticated
using (true);

drop policy if exists "Only admins can create public content" on public.site_content;
create policy "Only admins can create public content"
on public.site_content
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Only admins can update public content" on public.site_content;
create policy "Only admins can update public content"
on public.site_content
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Only admins can delete public content" on public.site_content;
create policy "Only admins can delete public content"
on public.site_content
for delete
to authenticated
using ((select public.is_admin()));

create or replace function public.set_site_content_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

revoke execute on function public.set_site_content_audit_fields() from public, anon, authenticated;

drop trigger if exists set_site_content_audit_fields on public.site_content;
create trigger set_site_content_audit_fields
before insert or update on public.site_content
for each row
execute function public.set_site_content_audit_fields();

-- Lessons 1-5 belong to the owner's private account and must never be stored
-- in the public site_content payload, even when an administrator writes
-- directly through the REST API.
create or replace function public.reject_private_lessons_in_public_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  lessons jsonb;
begin
  if new.content_key <> 'official_lessons' then
    return new;
  end if;

  lessons := case
    when jsonb_typeof(new.content) = 'object' then coalesce(new.content -> 'lessons', '[]'::jsonb)
    else new.content
  end;

  if jsonb_typeof(lessons) <> 'array' then
    return new;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(lessons) as lesson
    where coalesce(lesson ->> 'id', '') in (
      'lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5'
    )
  ) then
    raise exception 'Lessons 1-5 are private and cannot be published';
  end if;

  return new;
end;
$$;

revoke execute on function public.reject_private_lessons_in_public_content() from public, anon, authenticated;

drop trigger if exists reject_private_lessons_in_public_content on public.site_content;
create trigger reject_private_lessons_in_public_content
before insert or update on public.site_content
for each row
execute function public.reject_private_lessons_in_public_content();
