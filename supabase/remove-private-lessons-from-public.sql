-- Run once in Supabase Dashboard > SQL Editor.
-- Removes lessons 1-5 from the public site_content payload without touching
-- the owner's private user_snapshots row.

with source as (
  select
    content_key,
    case
      when jsonb_typeof(content) = 'object' then content
      else jsonb_build_object('schemaVersion', 1, 'lessons', content)
    end as payload
  from public.site_content
  where content_key = 'official_lessons'
), cleaned as (
  select
    content_key,
    payload,
    coalesce(
      (
        select jsonb_agg(lesson)
        from jsonb_array_elements(coalesce(payload -> 'lessons', '[]'::jsonb)) as lesson
        where coalesce(lesson ->> 'id', '') not in (
          'lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5'
        )
      ),
      '[]'::jsonb
    ) as public_lessons
  from source
)
update public.site_content as target
set content = jsonb_set(
      cleaned.payload,
      '{lessons}',
      cleaned.public_lessons,
      true
    ),
    updated_at = now()
from cleaned
where target.content_key = cleaned.content_key;

-- Prevent these private lessons from being inserted again through the public
-- REST endpoint or the administrator console.
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
