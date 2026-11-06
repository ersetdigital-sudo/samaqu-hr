-- =============================================================================
-- 20261103180000_employee_reactivation_update_guards.sql
-- Audit & finalisasi keamanan Langkah 2.
--
-- 1. Reaktivasi karyawan: audit trail status + validasi database.
-- 2. Validasi database untuk UPDATE kontrak (sebelumnya hanya INSERT).
-- 3. Jalur resmi perubahan `employees.employment_type` dijaga trigger.
--
-- Sifat migration: aditif. Tidak ada data existing yang diubah/dihapus, tidak
-- ada drop tabel/kolom, tidak ada reseed/reset sequence.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Audit perubahan status karyawan
-- ---------------------------------------------------------------------------
create table if not exists public.employee_status_history (
  id bigserial primary key,
  employee_id text not null
    references public.employees (id) on delete cascade,
  action text not null
    check (action in ('Reaktivasi', 'Perubahan Status')),
  from_status text not null
    check (from_status in ('Aktif', 'Probation', 'Nonaktif')),
  to_status text not null
    check (to_status in ('Aktif', 'Probation', 'Nonaktif')),
  reason text,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

comment on table public.employee_status_history is
  'Audit perubahan status karyawan. Reaktivasi (Nonaktif → Aktif) wajib punya alasan dan tercatat dengan action = Reaktivasi.';

create index if not exists employee_status_history_employee_idx
  on public.employee_status_history (employee_id, changed_at desc);

-- Validasi: Nonaktif → Aktif hanya boleh lewat aksi Reaktivasi (yang mengisi
-- alasan pada setting transaksi). UPDATE langsung dari luar tetap ditolak.
create or replace function public.validate_employee_status_update()
returns trigger
language plpgsql
as $$
declare
  v_reason text;
begin
  if new.status = 'Aktif' and old.status is distinct from 'Aktif' then
    v_reason := nullif(
      btrim(coalesce(current_setting('hr.status_change_reason', true), '')),
      ''
    );

    if v_reason is null then
      raise exception
        'Reaktivasi karyawan wajib melalui aksi Reaktivasi dengan alasan yang jelas.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists employees_validate_status_update on public.employees;
create trigger employees_validate_status_update
  before update of status on public.employees
  for each row execute function public.validate_employee_status_update();

-- Pencatatan audit: satu baris untuk setiap perubahan status, dengan pembeda
-- aksi sehingga reaktivasi tidak tercampur perubahan status biasa.
create or replace function public.log_employee_status_change()
returns trigger
language plpgsql
as $$
declare
  v_reason text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_reason := nullif(
    btrim(coalesce(current_setting('hr.status_change_reason', true), '')),
    ''
  );

  insert into public.employee_status_history (
    employee_id, action, from_status, to_status, reason, changed_by
  )
  values (
    new.id,
    case
      when old.status = 'Nonaktif' and new.status = 'Aktif' then 'Reaktivasi'
      else 'Perubahan Status'
    end,
    old.status,
    new.status,
    v_reason,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists employees_log_status_change on public.employees;
create trigger employees_log_status_change
  after update of status on public.employees
  for each row execute function public.log_employee_status_change();

-- ---------------------------------------------------------------------------
-- 2. Aksi reaktivasi (atomik, server-only)
--
-- Hanya mengubah status. Employee ID, jenis hubungan kerja, tanggal bergabung,
-- probation, dan kontrak tidak disentuh.
-- ---------------------------------------------------------------------------
create or replace function public.reactivate_employee(
  p_employee_id text,
  p_reason text
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
  v_reason text;
begin
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
    raise exception
      'Hanya karyawan berstatus Nonaktif yang bisa direaktivasi'
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

comment on function public.reactivate_employee(text, text) is
  'Reaktivasi Nonaktif → Aktif dengan alasan wajib; audit dicatat dalam transaksi yang sama.';

revoke execute on function public.reactivate_employee(text, text)
  from anon, authenticated;
grant execute on function public.reactivate_employee(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Validasi UPDATE kontrak
--
-- INSERT sudah dijaga `contracts_validate_insert`; UPDATE belum. Aturan:
--  * kontrak non-Aktif tidak boleh kembali Aktif lewat UPDATE biasa,
--  * kontrak karyawan Nonaktif tidak bisa diaktifkan (harus reaktivasi),
--  * kontrak Tetap tidak boleh punya tanggal akhir.
-- Overlap tetap dijaga EXCLUDE `contracts_no_overlap` (berlaku juga saat
-- UPDATE tanggal/employee_id karena constraint dievaluasi ulang per baris).
-- ---------------------------------------------------------------------------
create or replace function public.validate_contract_update()
returns trigger
language plpgsql
as $$
declare
  v_employee_status text;
begin
  if new.status = 'Aktif' and old.status is distinct from 'Aktif' then
    select status into v_employee_status
    from public.employees
    where id = new.employee_id;

    if v_employee_status = 'Nonaktif' then
      raise exception
        'Kontrak milik karyawan Nonaktif tidak bisa diaktifkan kembali. Reaktivasi karyawan lebih dulu, lalu buat kontrak baru.'
        using errcode = 'P0001';
    end if;

    raise exception
      'Kontrak berstatus % tidak bisa diubah kembali menjadi Aktif. Gunakan alur perpanjangan atau buat kontrak baru.',
      old.status
      using errcode = 'P0001';
  end if;

  if new.employment_type = 'Tetap' and new.end_date is not null then
    raise exception
      'Kontrak Tetap tidak memakai tanggal berakhir. Gunakan mekanisme perubahan jenis hubungan kerja.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_validate_update on public.contracts;
create trigger contracts_validate_update
  before update on public.contracts
  for each row execute function public.validate_contract_update();

-- ---------------------------------------------------------------------------
-- 4. Jalur resmi perubahan jenis hubungan kerja karyawan
--
-- Sebelumnya aplikasi meng-update `employees.employment_type` langsung lewat
-- service role, sehingga jalur lain bisa melakukan hal yang sama tanpa audit.
-- Kini perubahan hanya bisa lewat fungsi ini (yang menandai transaksi) dan
-- setiap perubahan tercatat di contract_history.
-- ---------------------------------------------------------------------------
create or replace function public.validate_employee_employment_type()
returns trigger
language plpgsql
as $$
begin
  if new.employment_type is distinct from old.employment_type then
    if nullif(current_setting('hr.employment_type_sync', true), '') is null then
      raise exception
        'Jenis hubungan kerja karyawan hanya bisa diubah melalui modul Kontrak & Masa Kerja.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists employees_validate_employment_type on public.employees;
create trigger employees_validate_employment_type
  before update on public.employees
  for each row execute function public.validate_employee_employment_type();

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
set search_path = public
as $$
declare
  emp public.employees;
begin
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
    raise exception
      'Kontrak % bukan milik karyawan %', p_contract_id, p_employee_id
      using errcode = 'P0001';
  end if;

  if emp.employment_type = p_new_type then
    return emp;
  end if;

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

comment on function public.sync_employee_employment_type(text, text, text, uuid, text) is
  'Jalur resmi satu-satunya untuk mengubah employees.employment_type; tercatat di contract_history.';

revoke execute on function public.sync_employee_employment_type(text, text, text, uuid, text)
  from anon, authenticated;
grant execute on function public.sync_employee_employment_type(text, text, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Keamanan tabel audit baru
-- ---------------------------------------------------------------------------
alter table public.employee_status_history enable row level security;

revoke all on table public.employee_status_history from anon, authenticated;
revoke all on sequence public.employee_status_history_id_seq from anon, authenticated;

grant select, insert, update, delete on table public.employee_status_history
  to service_role;
grant usage, select on sequence public.employee_status_history_id_seq
  to service_role;

commit;

notify pgrst, 'reload schema';
