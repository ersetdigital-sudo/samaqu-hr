-- Aktivasi otomatis akun Diundang saat pemiliknya login pertama kali.
-- Hanya menyentuh baris milik pemanggil dan hanya dari status 'Diundang'.
create or replace function public.activate_invited_user()
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  perform set_config(
    'hr.access_reason',
    'Aktivasi otomatis oleh sistem saat login pertama',
    true
  );

  update public.user_profiles
  set account_status = 'Aktif'
  where id = v_uid
    and account_status = 'Diundang';

  return found;
end;
$function$;

comment on function public.activate_invited_user() is
  'Mengaktifkan akun Diundang milik pemanggil saat login pertama. Status Nonaktif dan akun lain tidak disentuh.';

revoke execute on function public.activate_invited_user() from public, anon;
grant execute on function public.activate_invited_user() to authenticated;

notify pgrst, 'reload schema';
