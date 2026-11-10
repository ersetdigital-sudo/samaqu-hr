-- Hapus akun pengguna dengan aturan ketat + audit permanen tanpa FK.
--
-- Tabel audit sengaja tidak memakai foreign key ke auth.users/user_profiles
-- supaya snapshot tetap ada setelah akun dihapus.

create table if not exists public.account_deletion_log (
  id bigserial primary key,
  user_id uuid not null,
  full_name text not null,
  email text not null,
  roles text[] not null default '{}'::text[],
  employee_id text,
  deleted_by uuid,
  deleted_by_name text,
  deleted_by_email text,
  reason text not null default 'Dihapus oleh admin',
  deleted_at timestamptz not null default now()
);

create index if not exists account_deletion_log_deleted_at_idx
  on public.account_deletion_log (deleted_at desc);

alter table public.account_deletion_log enable row level security;

drop policy if exists account_deletion_log_admin_read on public.account_deletion_log;
create policy account_deletion_log_admin_read on public.account_deletion_log
  for select to authenticated
  using (public.current_has_role(array['admin']));

revoke all on public.account_deletion_log from anon;
revoke insert, update, delete on public.account_deletion_log from authenticated;
grant select on public.account_deletion_log to authenticated, service_role;
grant insert on public.account_deletion_log to service_role;
grant usage, select on sequence public.account_deletion_log_id_seq to service_role;

-- Alasan akun tidak boleh dihapus. Dipakai fungsi check & overview.
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
          where p.id = p_user_id and p.last_sign_in_at is not null
        )
        or exists (
          select 1 from auth.users u
          where u.id = p_user_id and u.last_sign_in_at is not null
        )
        or exists (
          select 1 from auth.sessions s where s.user_id = p_user_id
        )
        then 'Akun ini sudah pernah login'
    end,
    case
      when exists (select 1 from public.user_access_history h where h.changed_by = p_user_id)
        or exists (select 1 from public.user_roles ur where ur.created_by = p_user_id)
        or exists (select 1 from public.job_postings j where j.created_by = p_user_id)
        or exists (select 1 from public.contract_history c where c.changed_by = p_user_id)
        or exists (select 1 from public.employee_status_history e where e.changed_by = p_user_id)
        or exists (select 1 from public.interviews i where i.created_by = p_user_id)
        or exists (select 1 from public.interview_evaluations ev where ev.evaluated_by = p_user_id)
        then 'Akun ini sudah dipakai, nonaktifkan saja'
    end,
    case
      when exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p_user_id and r.name = 'admin'
        )
        and (
          select count(*)
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where r.name = 'admin'
        ) <= 1
        then 'Tidak bisa menghapus admin terakhir'
    end
  ], null), '{}'::text[])
$function$;

revoke execute on function public.account_deletion_blockers(uuid) from public, anon, authenticated;

-- Snapshot + kelayakan satu akun (dipanggil route API dengan sesi admin).
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
    'blockers', to_jsonb(public.account_deletion_blockers(p_user_id))
  );
end;
$function$;

revoke execute on function public.account_deletion_check(uuid) from public, anon;
grant execute on function public.account_deletion_check(uuid) to authenticated;

-- Daftar kelayakan semua akun untuk tombol Hapus di halaman pengguna.
create or replace function public.account_deletion_overview()
returns table (user_id uuid, blockers text[])
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
    select p.id, public.account_deletion_blockers(p.id)
    from public.user_profiles p;
end;
$function$;

revoke execute on function public.account_deletion_overview() from public, anon;
grant execute on function public.account_deletion_overview() to authenticated;

notify pgrst, 'reload schema';
