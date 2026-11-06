-- =============================================================================
-- 20261106120000_admin_superuser_access.sql
-- Akses penuh role admin secara terpusat.
--
--  * public.current_has_role() menganggap role aktif `admin` cocok dengan
--    semua permintaan role. Semua policy RLS dan RPC yang sudah memakai
--    helper ini otomatis ikut; tidak ada policy yang ditambah satu per satu.
--  * RPC yang sebelumnya mengecek `current_app_role() = 'hr_manager'` diubah
--    agar memakai current_has_role().
--  * Riwayat tetap read-only untuk authenticated/admin:
--    contract_history / employee_status_history / user_access_history hanya
--    boleh SELECT. INSERT langsung (termasuk policy admin lama) dicabut;
--    penulisan tetap lewat trigger SECURITY DEFINER / service_role.
--
-- Tidak mengubah data karyawan/kontrak/histori existing.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Sumber tunggal superuser: admin lolos semua cek current_has_role()
-- ---------------------------------------------------------------------------
create or replace function public.current_has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  with active_role as (
    select public.current_app_role() as name
  )
  select coalesce(
    (select name from active_role) = 'admin'
    or (select name from active_role) = any (roles),
    false
  );
$$;

comment on function public.current_has_role(text[]) is
  'True bila role aktif adalah admin (superuser) atau salah satu role yang diminta.';

revoke all on function public.current_has_role(text[]) from public;
revoke all on function public.current_has_role(text[]) from anon;
grant execute on function public.current_has_role(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC: guard memakai current_has_role, logika bisnis tidak diubah
-- ---------------------------------------------------------------------------
create or replace function public.reactivate_employee(
  p_employee_id text,
  p_reason text
)
returns public.employees
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  emp public.employees;
  v_reason text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager yang dapat mereaktivasi karyawan'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan reaktivasi wajib diisi' using errcode = 'P0001';
  end if;

  select * into emp
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  if emp.status <> 'Nonaktif' then
    raise exception 'Hanya karyawan berstatus Nonaktif yang bisa direaktivasi'
      using errcode = 'P0001';
  end if;

  perform set_config('hr.status_change_reason', v_reason, true);

  update public.employees
  set status = 'Aktif'
  where id = p_employee_id
  returning * into emp;

  return emp;
end;
$$;

create or replace function public.sync_employee_employment_type(
  p_employee_id text,
  p_expected_type text,
  p_new_type text,
  p_contract_id uuid,
  p_note text default null
)
returns public.employees
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  emp public.employees;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager yang dapat mengubah jenis hubungan kerja'
      using errcode = '42501';
  end if;

  if p_new_type not in ('Tetap', 'Kontrak', 'Magang', 'Harian') then
    raise exception 'Jenis hubungan kerja tidak valid' using errcode = 'P0001';
  end if;

  select * into emp
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.contracts
    where id = p_contract_id and employee_id = p_employee_id
  ) then
    raise exception 'Kontrak % bukan milik karyawan %', p_contract_id, p_employee_id
      using errcode = 'P0001';
  end if;

  if emp.employment_type is distinct from p_new_type then
    if emp.employment_type is distinct from p_expected_type then
      raise exception
        'Jenis hubungan kerja karyawan sudah berubah menjadi %. Muat ulang data sebelum mencoba lagi.',
        emp.employment_type
        using errcode = 'P0001';
    end if;

    perform set_config('hr.employment_type_sync', p_contract_id::text, true);

    update public.employees
    set employment_type = p_new_type
    where id = p_employee_id
    returning * into emp;
  end if;

  update public.contracts
  set employment_type = p_new_type
  where employee_id = p_employee_id
    and status = 'Aktif'
    and employment_type <> p_new_type;

  insert into public.contract_history (
    contract_id, employee_id, event, changes, note, changed_by
  )
  values (
    p_contract_id,
    p_employee_id,
    'Diubah',
    jsonb_build_object(
      'employee_employment_type',
      jsonb_build_object('from', p_expected_type, 'to', p_new_type)
    ),
    coalesce(
      nullif(btrim(coalesce(p_note, '')), ''),
      'Jenis hubungan kerja karyawan disinkronkan dengan kontrak'
    ),
    auth.uid()
  );

  return emp;
end;
$$;

create or replace function public.renew_contract(
  p_previous_id uuid,
  p_start_date date,
  p_end_date date,
  p_note text default null,
  p_gap_reason text default null
)
returns public.contracts
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  prev public.contracts;
  created public.contracts;
  v_default_start date;
  v_start date;
  v_gap_reason text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager yang dapat memperpanjang kontrak'
      using errcode = '42501';
  end if;

  select * into prev from public.contracts where id = p_previous_id for update;

  if not found then
    raise exception 'Kontrak sebelumnya tidak ditemukan' using errcode = 'P0002';
  end if;
  if prev.status <> 'Aktif' then
    raise exception 'Hanya kontrak Aktif yang bisa diperpanjang' using errcode = 'P0001';
  end if;
  if prev.employment_type = 'Tetap' then
    raise exception
      'Kontrak Tetap tidak bisa diperpanjang. Gunakan perubahan jenis hubungan kerja bila karyawan beralih ke kontrak berjangka.'
      using errcode = 'P0001';
  end if;
  if prev.end_date is null then
    raise exception
      'Kontrak sebelumnya belum punya tanggal berakhir sehingga perpanjangan tidak bisa dihitung'
      using errcode = 'P0001';
  end if;

  v_default_start := prev.end_date + 1;
  v_start := coalesce(p_start_date, v_default_start);
  v_gap_reason := nullif(btrim(coalesce(p_gap_reason, '')), '');

  if v_start <= prev.end_date then
    raise exception
      'Tanggal mulai perpanjangan (%) harus setelah tanggal berakhir kontrak sebelumnya (%)',
      v_start, prev.end_date
      using errcode = 'P0001';
  end if;
  if v_start <> v_default_start and v_gap_reason is null then
    raise exception
      'Tanggal mulai % berbeda dari tanggal default %. Alasan jeda kontrak wajib diisi.',
      v_start, v_default_start
      using errcode = 'P0001';
  end if;
  if p_end_date is null then
    raise exception 'Kontrak non-Tetap wajib punya tanggal berakhir' using errcode = 'P0001';
  end if;
  if p_end_date < v_start then
    raise exception 'Tanggal berakhir tidak boleh sebelum tanggal mulai' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.contracts c
    where c.employee_id = prev.employee_id
      and c.status = 'Aktif'
      and c.id <> prev.id
      and daterange(c.start_date, c.end_date, '[]')
          && daterange(v_start, p_end_date, '[]')
  ) then
    raise exception
      'Periode perpanjangan bertumpang tindih dengan kontrak Aktif lain milik karyawan ini'
      using errcode = '23P01';
  end if;

  update public.contracts set status = 'Diperpanjang' where id = prev.id;

  insert into public.contracts (
    employee_id, start_date, end_date, employment_type, status,
    previous_contract_id, note
  )
  values (
    prev.employee_id, v_start, p_end_date, prev.employment_type, 'Aktif',
    prev.id, p_note
  )
  returning * into created;

  insert into public.contract_history (
    contract_id, employee_id, event, changes, note, changed_by
  )
  values (
    created.id,
    created.employee_id,
    'Diperpanjang',
    jsonb_build_object(
      'previous_contract_id', prev.id,
      'previous_contract_number', prev.contract_number,
      'previous_end_date', prev.end_date,
      'default_start_date', v_default_start,
      'start_date', created.start_date,
      'gap_days', created.start_date - v_default_start,
      'gap_reason', v_gap_reason
    ),
    case
      when v_gap_reason is null
        then 'Perpanjangan tanpa jeda dari ' || prev.contract_number
      else 'Perpanjangan dengan jeda dari ' || prev.contract_number || ': ' || v_gap_reason
    end,
    auth.uid()
  );

  return created;
end;
$$;

revoke all on function public.reactivate_employee(text, text) from public;
revoke all on function public.reactivate_employee(text, text) from anon;
grant execute on function public.reactivate_employee(text, text)
  to authenticated, service_role;

revoke all on function public.sync_employee_employment_type(text, text, text, uuid, text) from public;
revoke all on function public.sync_employee_employment_type(text, text, text, uuid, text) from anon;
grant execute on function public.sync_employee_employment_type(text, text, text, uuid, text)
  to authenticated, service_role;

revoke all on function public.renew_contract(uuid, date, date, text, text) from public;
revoke all on function public.renew_contract(uuid, date, date, text, text) from anon;
grant execute on function public.renew_contract(uuid, date, date, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Riwayat tetap read-only untuk admin
-- ---------------------------------------------------------------------------
revoke insert, update, delete on table public.contract_history
  from anon, authenticated;
revoke insert, update, delete on table public.employee_status_history
  from anon, authenticated;
revoke insert, update, delete on table public.user_access_history
  from anon, authenticated;

revoke all on table public.contract_history from anon;
revoke all on table public.employee_status_history from anon;
revoke all on table public.user_access_history from anon;

grant select on table public.contract_history to authenticated;
grant select on table public.employee_status_history to authenticated;
grant select on table public.user_access_history to authenticated;

drop policy if exists user_access_history_admin_insert
  on public.user_access_history;

commit;

notify pgrst, 'reload schema';
