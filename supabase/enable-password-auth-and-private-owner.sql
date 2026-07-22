-- Run once in Supabase Dashboard > SQL Editor.
-- This does not read, store, or change any password. Passwords remain managed
-- by Supabase Auth. It only keeps lessons 1-5 attached to the original user ID
-- after that user changes their login email.

alter table public.profiles
add column if not exists owns_private_lessons boolean not null default false;

update public.profiles
set owns_private_lessons = true,
    updated_at = now()
where lower(email) = 'hexin20021111@gmail.com';

select email, role, owns_private_lessons
from public.profiles
where lower(email) in (
  'hexin20021111@gmail.com',
  '1343360767@qq.com'
)
order by email;
