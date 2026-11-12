-- =============================================================================
-- 20261110230000_employee_position_history.sql
-- Modul Mutasi & Promosi (riwayat perubahan posisi karyawan).
--
--  * employee_position_history: riwayat immutable (hanya SELECT untuk aplikasi;
--    satu-satunya penulis adalah fungsi record_employee_position_change).
--  * record_employee_position_change: SECURITY DEFINER, cek peran HR/Admin,
--    validasi + update employees + insert riwayat dalam satu transaksi.
--  * Guard existing di employees hanya bereaksi pada perubahan status dan
--    employment_type; fungsi ini tidak menyentuh keduanya.
-- =============================================================================

begin;

create table if not exists public.employee_position_history (
  id bigserial primary key,
  employee_id text not null
    references public.employees (id) on delete cascade,
  change_type text not null
    check (change_type in ('Promosi', 'Mutasi', 'Demosi')),
  effective_date date not null,
  reason text not null
    check (length(btrim(reason)) between 1 and 500),

  old_position text not null,
  new_position text not null,
  old_department text not null,
  new_department text not null,
  old_manager_id text,
  new_manager_id text,
  old_location text not null,
  new_location text not null,

  recorded_by uuid default auth.uid(),
  recorded_at timestamptz not null default now()
);

comment on table public.employee_position_history is
  'Riwayat immutable perubahan jabatan/departemen/atasan/lokasi. Hanya fungsi record_employee_position_change yang menulis.';

create index if not exists employee_position_history_employee_idx
  on public.employee_position_history (employee_id, effective_date desc, recorded_at desc);
create index if not exists employee_position_history_effective_idx
  on public.employee_position_history (effective_date desc);

alter table public.employee_position_history enable row level security;

drop policy if exists employee_position_history_staff_read
  on public.employee_position_history;
create policy employee_position_history_staff_read
  on public.employee_position_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists employee_position_history_self_read
  on public.employee_position_history;
create policy employee_position_history_self_read
  on public.employee_position_history
  for select to authenticated
  using (employee_id = public.current_employee_id());

revoke all on table public.employee_position_history
  from anon, public, authenticated;
grant select on table public.employee_position_history to authenticated;

revoke all on sequence public.employee_position_history_id_seq
  from anon, public, authenticated;
grant select, insert, update, delete on table public.employee_position_history
  to service_role;
grant usage, select on sequence public.employee_position_history_id_seq
  to service_role;

create or replace function public.record_employee_position_change(
  p_employee_id text,
  p_change_type text,
  p_effective_date date,
  p_reason text,
  p_old_position text,
  p_old_department text,
  p_old_manager_id text,
  p_old_location text,
  p_new_position text,
  p_new_department text,
  p_new_manager_id text,
  p_new_location text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee public.employees;
  v_manager public.employees;
  v_reason text;
  v_new_position text;
  v_new_department text;
  v_new_manager_id text;
  v_new_location text;
  v_old_manager_id text;
  v_today date;
  v_is_descendant boolean;
  v_history_id bigint;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mencatat perubahan posisi'
      using errcode = '42501';
  end if;

  if p_change_type is null
     or p_change_type not in ('Promosi', 'Mutasi', 'Demosi') then
    raise exception 'Jenis perubahan tidak valid' using errcode = 'P0001';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan perubahan wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_reason) > 500 then
    raise exception 'Alasan maksimal 500 karakter' using errcode = 'P0001';
  end if;

  v_new_position := btrim(coalesce(p_new_position, ''));
  if length(v_new_position) = 0 then
    raise exception 'Jabatan baru wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_new_position) > 150 then
    raise exception 'Jabatan maksimal 150 karakter' using errcode = 'P0001';
  end if;

  -- Sinkron dengan konstanta DEPARTMENTS/LOCATIONS pada form karyawan.
  v_new_department := btrim(coalesce(p_new_department, ''));
  if v_new_department not in (
    'People & Culture',
    'Customer Service',
    'Marketing',
    'Operasional',
    'Keuangan',
    'Teknologi'
  ) then
    raise exception 'Departemen tidak valid' using errcode = 'P0001';
  end if;

  v_new_location := btrim(coalesce(p_new_location, ''));
  if v_new_location not in (
    'Bandung (On-site)',
    'Jakarta (On-site)',
    'Remote'
  ) then
    raise exception 'Lokasi kerja tidak valid' using errcode = 'P0001';
  end if;

  if p_effective_date is null then
    raise exception 'Tanggal efektif wajib diisi' using errcode = 'P0001';
  end if;

  v_new_manager_id := nullif(btrim(coalesce(p_new_manager_id, '')), '');
  v_old_manager_id := nullif(btrim(coalesce(p_old_manager_id, '')), '');

  select * into v_employee
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_employee.status not in ('Aktif', 'Probation') then
    raise exception 'Karyawan Nonaktif tidak bisa dimutasi'
      using errcode = 'P0001';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;
  if p_effective_date > v_today then
    raise exception 'Tanggal efektif tidak boleh di masa depan'
      using errcode = 'P0001';
  end if;
  if p_effective_date < v_employee.joined_at then
    raise exception 'Tanggal efektif tidak boleh sebelum tanggal bergabung'
      using errcode = 'P0001';
  end if;

  -- Nilai lama dari klien harus sama dengan kondisi terkini (cegah race).
  if btrim(coalesce(p_old_position, '')) is distinct from v_employee.position
     or btrim(coalesce(p_old_department, '')) is distinct from v_employee.department
     or v_old_manager_id is distinct from v_employee.manager_id
     or btrim(coalesce(p_old_location, '')) is distinct from v_employee.location then
    raise exception 'Data karyawan sudah berubah. Muat ulang data lalu coba lagi.'
      using errcode = 'P0001';
  end if;

  if v_new_position is not distinct from v_employee.position
     and v_new_department is not distinct from v_employee.department
     and v_new_manager_id is not distinct from v_employee.manager_id
     and v_new_location is not distinct from v_employee.location then
    raise exception 'Tidak ada perubahan jabatan, departemen, atasan, atau lokasi'
      using errcode = 'P0001';
  end if;

  -- Atasan hanya divalidasi saat berubah; atasan lama yang sudah Nonaktif
  -- tidak memblokir perubahan field lain.
  if v_new_manager_id is not null
     and v_new_manager_id is distinct from v_employee.manager_id then
    if v_new_manager_id = v_employee.id then
      raise exception 'Atasan baru tidak boleh diri sendiri'
        using errcode = 'P0001';
    end if;

    select * into v_manager
    from public.employees
    where id = v_new_manager_id;

    if not found then
      raise exception 'Atasan baru tidak ditemukan' using errcode = 'P0001';
    end if;
    if v_manager.status not in ('Aktif', 'Probation') then
      raise exception 'Atasan baru harus berstatus Aktif atau Probation'
        using errcode = 'P0001';
    end if;

    -- UNION (bukan UNION ALL) agar traversal tetap berhenti pada data siklus.
    with recursive descendants(id) as (
      select e.id
      from public.employees e
      where e.manager_id = v_employee.id
      union
      select e.id
      from public.employees e
      join descendants d on e.manager_id = d.id
    )
    select exists (
      select 1 from descendants where id = v_new_manager_id
    ) into v_is_descendant;

    if v_is_descendant then
      raise exception 'Atasan baru tidak boleh bawahan dari karyawan ini'
        using errcode = 'P0001';
    end if;
  end if;

  update public.employees
  set position = v_new_position,
      department = v_new_department,
      manager_id = v_new_manager_id,
      location = v_new_location
  where id = v_employee.id;

  insert into public.employee_position_history (
    employee_id,
    change_type,
    effective_date,
    reason,
    old_position,
    new_position,
    old_department,
    new_department,
    old_manager_id,
    new_manager_id,
    old_location,
    new_location,
    recorded_by
  ) values (
    v_employee.id,
    p_change_type,
    p_effective_date,
    v_reason,
    v_employee.position,
    v_new_position,
    v_employee.department,
    v_new_department,
    v_employee.manager_id,
    v_new_manager_id,
    v_employee.location,
    v_new_location,
    auth.uid()
  )
  returning id into v_history_id;

  return v_history_id;
end;
$$;

comment on function public.record_employee_position_change(
  text, text, date, text, text, text, text, text, text, text, text, text
) is
  'Catat perubahan posisi secara atomik: validasi, update employees, insert riwayat. Hanya HR Manager/Admin.';

revoke all on function public.record_employee_position_change(
  text, text, date, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.record_employee_position_change(
  text, text, date, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
