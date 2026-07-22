-- 先在网站用邮箱验证码登录一次，再在 Supabase Dashboard > SQL Editor 运行本文件。
-- 只替换下一行的邮箱；不要把 service_role key 或数据库密码放进这里。

do $$
declare
  target_email text := 'YOUR_ADMIN_EMAIL';
  changed_rows integer := 0;
begin
  if target_email = 'YOUR_ADMIN_EMAIL' or position('@' in target_email) = 0 then
    raise exception '请先把 YOUR_ADMIN_EMAIL 替换为新的管理员登录邮箱';
  end if;

  update public.profiles
  set role = 'admin',
      updated_at = now()
  where lower(email) = lower(target_email);

  get diagnostics changed_rows = row_count;
  if changed_rows = 0 then
    raise exception '没有找到该邮箱。请先在网站完成一次邮箱验证码登录，再重试。';
  end if;

  raise notice '管理员设置成功：%', target_email;
end;
$$;
