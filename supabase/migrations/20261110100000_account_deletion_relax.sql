-- Relaksasi aturan hapus akun:
--  * Nonaktif boleh dihapus (walau pernah login).
--  * Diundang hanya boleh dihapus bila belum pernah login.
--  * Aktif, akun sendiri, dan admin aktif terakhir tetap diblokir.
--  * Jejak sebagai pelaku tidak lagi memblokir; referensi aktor dipertahankan
--    supaya bisa tampil sebagai "Pengguna terhapus".

alter table public.account_deletion_log
  add column if not exists account_status text not null default 'Tidak diketahui';

-- Simpan UUID pelaku di jejak kontrak meski akunnya dihapus.
alter table public.contract_history
  drop constraint if exists contract_history_changed_by_fkey;

create or replace function public.account_has_traces(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
  select
    exists (
      select 1 from public.user_profiles p
      where p.id = p_user_id and p.last_sign_in_at is not null
    )
    or exists (
      select 1 from auth.users u
      where u.id = p_user_id and u.last_sign_in_at is not null
    )
    or exists (select 1 from auth.sessions s where s.user_id = p_user_id)
    or exists (select 1 from public.interviews i where i.created_by = p_user_id)
    or exists (select 1 from public.interview_evaluations e where e.evaluated_by = p_user_id)
    or exists (select 1 from public.job_postings j where j.created_by = p_user_id)
    or exists (select 1 from public.contract_history c where c.changed_by = p_user_id)
    or exists (select 1 from public.employee_status_history e where e.changed_by = p_user_id)
    or exists (select 1 from public.user_access_history h where h.changed_by = p_user_id)
    or exists (select 1 from public.user_roles ur where ur.created_by = p_user_id)
$function$;

revoke execute on function public.account_has_traces(uuid) from public, anon, authenticated;

create or replace function public.account_deletion_blockers(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
  select coalesce(array_remove(array[
    case
      when p_user_id = auth.uid()
        then 'Tidak bisa menghapus akun sendiri'
    end,
    case
      when exists (
          select 1 from public.user_profiles p
          where p.id = p_user_id and p.account_status = 'Aktif'
        )
        then 'Nonaktifkan akun dulu'
    end,
    case
      when exists (
          select 1 from public.user_profiles p
          where p.id = p_user_id and p.account_status = 'Diundang'
        )
        and (
          exists (
            select 1 from public.user_profiles p
            where p.id = p_user_id and p.last_sign_in_at is not null
          )
          or exists (
            select 1 from auth.users u
            where u.id = p_user_id and u.last_sign_in_at is not null
          )
          or exists (select 1 from auth.sessions s where s.user_id = p_user_id)
        )
        then 'Akun Diundang yang sudah pernah login tidak bisa dihapus'
    end,
    case
      when exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p_user_id and r.name = 'admin'
        )
        and exists (
          select 1 from public.user_profiles p
          where p.id = p_user_id and p.account_status = 'Aktif'
        )
        and (
          select count(*)
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          join public.user_profiles p on p.id = ur.user_id
          where r.name = 'admin' and p.account_status = 'Aktif'
        ) <= 1
        then 'Tidak bisa menghapus admin terakhir'
    end
  ], null), '{}'::text[])
$function$;

revoke execute on function public.account_deletion_blockers(uuid) from public, anon, authenticated;

create or replace function public.account_deletion_check(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  v_profile public.user_profiles;
  v_roles text[];
begin
  if not public.current_has_role(array['admin']) then
    raise exception 'Akses ditolak: hanya admin yang dapat menghapus akun'
      using errcode = '42501';
  end if;

  select * into v_profile
  from public.user_profiles
  where id = p_user_id;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  select coalesce(array_agg(r.name order by r.name), '{}'::text[])
    into v_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id;

  return jsonb_build_object(
    'exists', true,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'roles', to_jsonb(v_roles),
    'employee_id', v_profile.employee_id,
    'account_status', v_profile.account_status,
    'has_traces', public.account_has_traces(p_user_id),
    'blockers', to_jsonb(public.account_deletion_blockers(p_user_id))
  );
end;
$function$;

revoke execute on function public.account_deletion_check(uuid) from public, anon;
grant execute on function public.account_deletion_check(uuid) to authenticated;

drop function if exists public.account_deletion_overview();

create function public.account_deletion_overview()
returns table (
  user_id uuid,
  blockers text[],
  has_traces boolean,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if not public.current_has_role(array['admin']) then
    raise exception 'Akses ditolak: hanya admin yang dapat memeriksa akun'
      using errcode = '42501';
  end if;

  return query
    select
      p.id,
      public.account_deletion_blockers(p.id),
      public.account_has_traces(p.id),
      greatest(p.last_sign_in_at, u.last_sign_in_at)
    from public.user_profiles p
    left join auth.users u on u.id = p.id;
end;
$function$;

revoke execute on function public.account_deletion_overview() from public, anon;
grant execute on function public.account_deletion_overview() to authenticated;

-- Nama pelaku untuk tampilan audit (hanya nama, bukan data sensitif lain).
create or replace function public.user_full_names(p_ids uuid[])
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if not public.current_has_role(array['admin', 'hr_manager']) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name
    from public.user_profiles p
    where p.id = any(p_ids);
end;
$function$;

revoke execute on function public.user_full_names(uuid[]) from public, anon;
grant execute on function public.user_full_names(uuid[]) to authenticated;

-- Isi ulang waktu login lama dari sumber auth (additive, hanya bila lebih baru).
update public.user_profiles p
set last_sign_in_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and u.last_sign_in_at is not null
  and (p.last_sign_in_at is null or p.last_sign_in_at < u.last_sign_in_at);

notify pgrst, 'reload schema';
