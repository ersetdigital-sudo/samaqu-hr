-- =============================================================================
-- 20261110240000_attendance_stage_a.sql
-- Attendance Tahap A: jadwal kerja, kalender libur, kehadiran harian.
--
--  * Semua penulisan kehadiran lewat fungsi SECURITY DEFINER.
--  * Tabel kehadiran & riwayat koreksi SELECT-only untuk authenticated.
--  * Jam/tanggal server memakai Asia/Jakarta.
--  * Status harian tidak disimpan; dihitung saat dibaca oleh aplikasi.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Jadwal kerja (satu default aktif; siap dikembangkan per karyawan)
-- ---------------------------------------------------------------------------
create table if not exists public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id text references public.employees (id) on delete cascade,
  name text not null default 'Jadwal Kerja Utama'
    check (length(btrim(name)) between 1 and 100),
  work_days smallint[] not null
    check (
      cardinality(work_days) > 0
      and work_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    ),
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 60
    check (break_minutes between 0 and 240),
  late_tolerance_minutes integer not null default 10
    check (late_tolerance_minutes between 0 and 120),
  is_active boolean not null default true,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_schedules_time_order check (start_time < end_time)
);

create unique index if not exists work_schedules_active_company_idx
  on public.work_schedules ((employee_id is null))
  where is_active and employee_id is null;
create unique index if not exists work_schedules_active_employee_idx
  on public.work_schedules (employee_id)
  where is_active and employee_id is not null;

drop trigger if exists work_schedules_set_updated_at
  on public.work_schedules;
create trigger work_schedules_set_updated_at
  before update on public.work_schedules
  for each row execute function public.set_updated_at();

insert into public.work_schedules (
  employee_id, name, work_days, start_time, end_time,
  break_minutes, late_tolerance_minutes, is_active
)
select
  null,
  'Jadwal Kerja Utama',
  array[1, 2, 3, 4, 5, 6]::smallint[],
  '08:00'::time,
  '17:00'::time,
  60,
  10,
  true
where not exists (
  select 1 from public.work_schedules
  where is_active and employee_id is null
);

-- ---------------------------------------------------------------------------
-- 2. Kalender libur
-- ---------------------------------------------------------------------------
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null
    check (length(btrim(name)) between 1 and 100),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists holidays_set_updated_at on public.holidays;
create trigger holidays_set_updated_at
  before update on public.holidays
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Kehadiran harian
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null
    references public.employees (id) on delete cascade,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  source text not null default 'Mandiri'
    check (source in ('Mandiri', 'Koreksi HR')),
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_employee_day_key unique (employee_id, work_date),
  constraint attendance_checkout_order check (
    check_out_at is null
    or (check_in_at is not null and check_out_at > check_in_at)
  )
);

create index if not exists attendance_employee_date_idx
  on public.attendance (employee_id, work_date);
create index if not exists attendance_work_date_idx
  on public.attendance (work_date);

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Riwayat koreksi (immutable)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_corrections (
  id bigserial primary key,
  attendance_id uuid not null,
  employee_id text not null,
  work_date date not null,
  old_check_in_at timestamptz,
  old_check_out_at timestamptz,
  new_check_in_at timestamptz,
  new_check_out_at timestamptz,
  reason text not null
    check (length(btrim(reason)) between 1 and 500),
  corrected_by uuid,
  corrected_at timestamptz not null default now()
);

create index if not exists attendance_corrections_employee_idx
  on public.attendance_corrections (employee_id, work_date, corrected_at desc);
create index if not exists attendance_corrections_attendance_idx
  on public.attendance_corrections (attendance_id);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.work_schedules enable row level security;
alter table public.holidays enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_corrections enable row level security;

drop policy if exists work_schedules_read on public.work_schedules;
create policy work_schedules_read on public.work_schedules
  for select to authenticated
  using (public.current_has_role(array['hr_manager', 'employee']));

drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays
  for select to authenticated
  using (public.current_has_role(array['hr_manager', 'employee']));

drop policy if exists attendance_staff_read on public.attendance;
create policy attendance_staff_read on public.attendance
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists attendance_self_read on public.attendance;
create policy attendance_self_read on public.attendance
  for select to authenticated
  using (employee_id = public.current_employee_id());

drop policy if exists attendance_corrections_staff_read
  on public.attendance_corrections;
create policy attendance_corrections_staff_read
  on public.attendance_corrections
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists attendance_corrections_self_read
  on public.attendance_corrections;
create policy attendance_corrections_self_read
  on public.attendance_corrections
  for select to authenticated
  using (employee_id = public.current_employee_id());

-- ---------------------------------------------------------------------------
-- 6. Hak tabel: SELECT-only untuk authenticated
-- ---------------------------------------------------------------------------
revoke all on table public.work_schedules from anon, public, authenticated;
revoke all on table public.holidays from anon, public, authenticated;
revoke all on table public.attendance from anon, public, authenticated;
revoke all on table public.attendance_corrections from anon, public, authenticated;

grant select on table public.work_schedules to authenticated;
grant select on table public.holidays to authenticated;
grant select on table public.attendance to authenticated;
grant select on table public.attendance_corrections to authenticated;

revoke all on sequence public.attendance_corrections_id_seq
  from anon, public, authenticated;

grant select, insert, update, delete on table public.work_schedules to service_role;
grant select, insert, update, delete on table public.holidays to service_role;
grant select, insert, update, delete on table public.attendance to service_role;
grant select, insert, update, delete on table public.attendance_corrections
  to service_role;
grant usage, select on sequence public.attendance_corrections_id_seq
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. Check-in / check-out mandiri
-- ---------------------------------------------------------------------------
create or replace function public.check_in()
returns public.attendance
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_employee public.employees;
  v_schedule public.work_schedules;
  v_today date;
  v_holiday_name text;
  v_attendance public.attendance;
begin
  if not public.current_has_role(array['employee', 'hr_manager']) then
    raise exception 'Akses ditolak: hanya karyawan yang dapat check-in'
      using errcode = '42501';
  end if;

  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    raise exception 'Akun belum tertaut ke data karyawan'
      using errcode = 'P0001';
  end if;

  select * into v_employee
  from public.employees
  where id = v_employee_id
  for update;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_employee.status not in ('Aktif', 'Probation') then
    raise exception 'Karyawan Nonaktif tidak bisa melakukan absensi'
      using errcode = 'P0001';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;

  select * into v_schedule
  from public.work_schedules
  where is_active
    and (employee_id = v_employee_id or employee_id is null)
  order by employee_id nulls last
  limit 1;

  if not found then
    raise exception 'Jadwal kerja belum diatur' using errcode = 'P0001';
  end if;
  if not (extract(isodow from v_today)::smallint = any (v_schedule.work_days)) then
    raise exception 'Hari ini bukan hari kerja' using errcode = 'P0001';
  end if;

  select name into v_holiday_name
  from public.holidays
  where holiday_date = v_today;

  if v_holiday_name is not null then
    raise exception 'Hari ini libur: %', v_holiday_name
      using errcode = 'P0001';
  end if;

  -- Idempotent & race-safe: unique (employee_id, work_date) + row lock.
  insert into public.attendance (employee_id, work_date, check_in_at, source)
  values (v_employee_id, v_today, now(), 'Mandiri')
  on conflict (employee_id, work_date) do nothing;

  select * into v_attendance
  from public.attendance
  where employee_id = v_employee_id and work_date = v_today
  for update;

  if v_attendance.check_in_at is null then
    update public.attendance
    set check_in_at = now(), source = 'Mandiri'
    where id = v_attendance.id
    returning * into v_attendance;
  end if;

  return v_attendance;
end;
$$;

create or replace function public.check_out()
returns public.attendance
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_employee public.employees;
  v_schedule public.work_schedules;
  v_today date;
  v_holiday_name text;
  v_attendance public.attendance;
begin
  if not public.current_has_role(array['employee', 'hr_manager']) then
    raise exception 'Akses ditolak: hanya karyawan yang dapat check-out'
      using errcode = '42501';
  end if;

  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    raise exception 'Akun belum tertaut ke data karyawan'
      using errcode = 'P0001';
  end if;

  select * into v_employee
  from public.employees
  where id = v_employee_id
  for update;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_employee.status not in ('Aktif', 'Probation') then
    raise exception 'Karyawan Nonaktif tidak bisa melakukan absensi'
      using errcode = 'P0001';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;

  select * into v_schedule
  from public.work_schedules
  where is_active
    and (employee_id = v_employee_id or employee_id is null)
  order by employee_id nulls last
  limit 1;

  if not found then
    raise exception 'Jadwal kerja belum diatur' using errcode = 'P0001';
  end if;
  if not (extract(isodow from v_today)::smallint = any (v_schedule.work_days)) then
    raise exception 'Hari ini bukan hari kerja' using errcode = 'P0001';
  end if;

  select name into v_holiday_name
  from public.holidays
  where holiday_date = v_today;

  if v_holiday_name is not null then
    raise exception 'Hari ini libur: %', v_holiday_name
      using errcode = 'P0001';
  end if;

  select * into v_attendance
  from public.attendance
  where employee_id = v_employee_id and work_date = v_today
  for update;

  if not found or v_attendance.check_in_at is null then
    raise exception 'Check-in dulu sebelum check-out'
      using errcode = 'P0001';
  end if;

  if v_attendance.check_out_at is null then
    update public.attendance
    set check_out_at = now()
    where id = v_attendance.id
    returning * into v_attendance;
  end if;

  return v_attendance;
end;
$$;

comment on function public.check_in() is
  'Check-in mandiri memakai waktu server WIB; idempotent terhadap request ulang.';
comment on function public.check_out() is
  'Check-out mandiri memakai waktu server WIB; hanya setelah check-in.';

-- ---------------------------------------------------------------------------
-- 8. Koreksi kehadiran HR/Admin
-- ---------------------------------------------------------------------------
create or replace function public.correct_attendance(
  p_employee_id text,
  p_work_date date,
  p_check_in_time time,
  p_check_out_time time,
  p_reason text
)
returns public.attendance
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee public.employees;
  v_attendance public.attendance;
  v_old_check_in timestamptz;
  v_old_check_out timestamptz;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_reason text;
  v_today date;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengoreksi kehadiran'
      using errcode = '42501';
  end if;

  if p_employee_id is null or btrim(p_employee_id) = '' then
    raise exception 'Karyawan wajib dipilih' using errcode = 'P0001';
  end if;
  if p_work_date is null then
    raise exception 'Tanggal wajib diisi' using errcode = 'P0001';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;
  if p_work_date > v_today then
    raise exception 'Tanggal koreksi tidak boleh di masa depan'
      using errcode = 'P0001';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan koreksi wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_reason) > 500 then
    raise exception 'Alasan koreksi maksimal 500 karakter'
      using errcode = 'P0001';
  end if;

  v_check_in := case
    when p_check_in_time is null then null
    else (p_work_date + p_check_in_time) at time zone 'Asia/Jakarta'
  end;
  v_check_out := case
    when p_check_out_time is null then null
    else (p_work_date + p_check_out_time) at time zone 'Asia/Jakarta'
  end;

  if v_check_in is null and v_check_out is null then
    raise exception 'Isi minimal jam masuk atau jam pulang'
      using errcode = 'P0001';
  end if;
  if v_check_out is not null and v_check_in is null then
    raise exception 'Jam pulang membutuhkan jam masuk'
      using errcode = 'P0001';
  end if;
  if v_check_in is not null and v_check_out is not null
     and v_check_out <= v_check_in then
    raise exception 'Jam pulang harus setelah jam masuk'
      using errcode = 'P0001';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  select * into v_attendance
  from public.attendance
  where employee_id = p_employee_id and work_date = p_work_date
  for update;

  if found then
    v_old_check_in := v_attendance.check_in_at;
    v_old_check_out := v_attendance.check_out_at;

    update public.attendance
    set check_in_at = v_check_in,
        check_out_at = v_check_out,
        source = 'Koreksi HR',
        notes = v_reason
    where id = v_attendance.id
    returning * into v_attendance;
  else
    v_old_check_in := null;
    v_old_check_out := null;

    insert into public.attendance (
      employee_id, work_date, check_in_at, check_out_at, source, notes
    ) values (
      p_employee_id, p_work_date, v_check_in, v_check_out, 'Koreksi HR', v_reason
    )
    returning * into v_attendance;
  end if;

  insert into public.attendance_corrections (
    attendance_id, employee_id, work_date,
    old_check_in_at, old_check_out_at,
    new_check_in_at, new_check_out_at,
    reason, corrected_by
  ) values (
    v_attendance.id, p_employee_id, p_work_date,
    v_old_check_in, v_old_check_out,
    v_check_in, v_check_out,
    v_reason, auth.uid()
  );

  return v_attendance;
end;
$$;

comment on function public.correct_attendance(text, date, time, time, text) is
  'Koreksi kehadiran HR/Admin; menulis kehadiran dan riwayat koreksi dalam satu transaksi.';

-- ---------------------------------------------------------------------------
-- 9. Jadwal kerja HR/Admin
-- ---------------------------------------------------------------------------
create or replace function public.update_work_schedule(
  p_work_days smallint[],
  p_start_time time,
  p_end_time time,
  p_break_minutes integer,
  p_late_tolerance_minutes integer
)
returns public.work_schedules
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_days smallint[];
  v_schedule public.work_schedules;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengubah jadwal'
      using errcode = '42501';
  end if;

  if p_work_days is null or cardinality(p_work_days) = 0 then
    raise exception 'Pilih minimal satu hari kerja' using errcode = 'P0001';
  end if;

  select array_agg(distinct d order by d) into v_days
  from unnest(p_work_days) as d;

  if v_days is null or exists (
    select 1 from unnest(v_days) as d where d not between 1 and 7
  ) then
    raise exception 'Hari kerja tidak valid' using errcode = 'P0001';
  end if;

  if p_start_time is null or p_end_time is null then
    raise exception 'Jam masuk dan jam pulang wajib diisi'
      using errcode = 'P0001';
  end if;
  if p_start_time >= p_end_time then
    raise exception 'Jam pulang harus setelah jam masuk'
      using errcode = 'P0001';
  end if;

  if p_break_minutes is null
     or p_break_minutes < 0 or p_break_minutes > 240 then
    raise exception 'Durasi istirahat harus 0–240 menit'
      using errcode = 'P0001';
  end if;
  if p_late_tolerance_minutes is null
     or p_late_tolerance_minutes < 0 or p_late_tolerance_minutes > 120 then
    raise exception 'Toleransi terlambat harus 0–120 menit'
      using errcode = 'P0001';
  end if;

  -- Serialisasi pengelolaan satu jadwal default aktif.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('attendance_schedule_default')::bigint
  );

  select * into v_schedule
  from public.work_schedules
  where is_active and employee_id is null
  for update;

  if found then
    update public.work_schedules
    set work_days = v_days,
        start_time = p_start_time,
        end_time = p_end_time,
        break_minutes = p_break_minutes,
        late_tolerance_minutes = p_late_tolerance_minutes,
        updated_by = auth.uid()
    where id = v_schedule.id
    returning * into v_schedule;
  else
    insert into public.work_schedules (
      employee_id, name, work_days, start_time, end_time,
      break_minutes, late_tolerance_minutes, is_active, updated_by
    ) values (
      null, 'Jadwal Kerja Utama', v_days, p_start_time, p_end_time,
      p_break_minutes, p_late_tolerance_minutes, true, auth.uid()
    )
    returning * into v_schedule;
  end if;

  return v_schedule;
end;
$$;

comment on function public.update_work_schedule(smallint[], time, time, integer, integer) is
  'Ubah satu jadwal kerja default aktif; siap dikembangkan menjadi jadwal per karyawan.';

-- ---------------------------------------------------------------------------
-- 10. Kalender libur HR/Admin
-- ---------------------------------------------------------------------------
create or replace function public.save_holiday(
  p_id uuid,
  p_holiday_date date,
  p_name text
)
returns public.holidays
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_name text;
  v_holiday public.holidays;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengubah kalender libur'
      using errcode = '42501';
  end if;

  if p_holiday_date is null then
    raise exception 'Tanggal libur wajib diisi' using errcode = 'P0001';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    raise exception 'Nama libur wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_name) > 100 then
    raise exception 'Nama libur maksimal 100 karakter'
      using errcode = 'P0001';
  end if;

  if p_id is null then
    begin
      insert into public.holidays (
        holiday_date, name, created_by, updated_by
      ) values (
        p_holiday_date, v_name, auth.uid(), auth.uid()
      )
      returning * into v_holiday;
    exception when unique_violation then
      raise exception 'Tanggal libur sudah terdaftar' using errcode = 'P0001';
    end;
  else
    begin
      update public.holidays
      set holiday_date = p_holiday_date,
          name = v_name,
          updated_by = auth.uid()
      where id = p_id
      returning * into v_holiday;

      if not found then
        raise exception 'Hari libur tidak ditemukan' using errcode = 'P0002';
      end if;
    exception when unique_violation then
      raise exception 'Tanggal libur sudah terdaftar' using errcode = 'P0001';
    end;
  end if;

  return v_holiday;
end;
$$;

create or replace function public.delete_holiday(p_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menghapus kalender libur'
      using errcode = '42501';
  end if;

  delete from public.holidays where id = p_id;
  if not found then
    raise exception 'Hari libur tidak ditemukan' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. EXECUTE fungsi
-- ---------------------------------------------------------------------------
revoke all on function public.check_in() from public, anon;
revoke all on function public.check_out() from public, anon;
revoke all on function public.correct_attendance(text, date, time, time, text)
  from public, anon;
revoke all on function public.update_work_schedule(smallint[], time, time, integer, integer)
  from public, anon;
revoke all on function public.save_holiday(uuid, date, text) from public, anon;
revoke all on function public.delete_holiday(uuid) from public, anon;

grant execute on function public.check_in() to authenticated, service_role;
grant execute on function public.check_out() to authenticated, service_role;
grant execute on function public.correct_attendance(text, date, time, time, text)
  to authenticated, service_role;
grant execute on function public.update_work_schedule(smallint[], time, time, integer, integer)
  to authenticated, service_role;
grant execute on function public.save_holiday(uuid, date, text)
  to authenticated, service_role;
grant execute on function public.delete_holiday(uuid)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
