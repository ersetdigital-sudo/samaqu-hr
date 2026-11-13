-- =============================================================================
-- 20261113110000_overtime_module.sql
-- Attendance Tahap C lanjutan: Lembur.
--
--  * Jenis hari ditentukan dari jadwal kerja aktif + hari libur.
--  * Semua penulisan lewat RPC SECURITY DEFINER.
--  * Batas 4 jam/hari dan 18 jam/minggu dihitung dari Menunggu + Disetujui.
--  * Jam ekuivalen dihitung fungsi database berdasarkan hari kerja/istirahat.
--  * Riwayat keputusan SELECT-only untuk authenticated (staf + diri sendiri).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Pengajuan lembur
-- ---------------------------------------------------------------------------
create table if not exists public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null
    references public.employees (id) on delete cascade,
  request_date date not null,
  start_time time not null,
  end_time time not null,
  requested_minutes integer not null
    check (
      requested_minutes between 30 and 240
      and mod(requested_minutes, 30) = 0
    ),
  day_type text not null
    check (day_type in ('workday', 'restday', 'holiday')),
  work_description text not null
    check (length(btrim(work_description)) between 1 and 1000),
  status text not null default 'Menunggu'
    check (status in ('Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan')),
  approved_minutes integer
    check (
      approved_minutes is null
      or (
        approved_minutes between 30 and requested_minutes
        and mod(approved_minutes, 30) = 0
      )
    ),
  equivalent_minutes integer
    check (equivalent_minutes is null or equivalent_minutes >= 0),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  decision_note text
    check (decision_note is null or length(decision_note) <= 1000),
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_kind text
    check (cancellation_kind is null or cancellation_kind in ('Karyawan', 'HR')),
  cancellation_reason text
    check (cancellation_reason is null or length(cancellation_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint overtime_time_order check (start_time < end_time),
  constraint overtime_minutes_match check (
    requested_minutes = (
      extract(epoch from (end_time - start_time)) / 60
    )::integer
  )
);

create index if not exists overtime_requests_employee_date_idx
  on public.overtime_requests (employee_id, request_date desc);
create index if not exists overtime_requests_status_date_idx
  on public.overtime_requests (status, request_date);
create index if not exists overtime_requests_active_date_idx
  on public.overtime_requests (employee_id, request_date)
  where status in ('Menunggu', 'Disetujui');

drop trigger if exists overtime_requests_set_updated_at
  on public.overtime_requests;
create trigger overtime_requests_set_updated_at
  before update on public.overtime_requests
  for each row execute function public.set_updated_at();

comment on table public.overtime_requests is
  'Pengajuan lembur. Jenis hari dan jam ekuivalen disimpan sebagai snapshot keputusan.';

-- ---------------------------------------------------------------------------
-- 2. Riwayat keputusan (immutable)
-- ---------------------------------------------------------------------------
create table if not exists public.overtime_request_history (
  id bigserial primary key,
  request_id uuid not null,
  employee_id text not null,
  action text not null
    check (action in (
      'Diajukan', 'Disetujui', 'Ditolak',
      'Dibatalkan Karyawan', 'Dibatalkan HR'
    )),
  from_status text,
  to_status text,
  reason text
    check (reason is null or length(reason) <= 1000),
  actor_id uuid,
  acted_at timestamptz not null default now()
);

create index if not exists overtime_request_history_request_idx
  on public.overtime_request_history (request_id, acted_at desc);
create index if not exists overtime_request_history_employee_idx
  on public.overtime_request_history (employee_id, acted_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
alter table public.overtime_requests enable row level security;
alter table public.overtime_request_history enable row level security;

drop policy if exists overtime_requests_staff_read on public.overtime_requests;
create policy overtime_requests_staff_read on public.overtime_requests
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists overtime_requests_self_read on public.overtime_requests;
create policy overtime_requests_self_read on public.overtime_requests
  for select to authenticated
  using (employee_id = public.current_employee_id());

drop policy if exists overtime_request_history_staff_read
  on public.overtime_request_history;
create policy overtime_request_history_staff_read
  on public.overtime_request_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists overtime_request_history_self_read
  on public.overtime_request_history;
create policy overtime_request_history_self_read
  on public.overtime_request_history
  for select to authenticated
  using (employee_id = public.current_employee_id());

-- ---------------------------------------------------------------------------
-- 4. Hak tabel: SELECT-only untuk aplikasi
-- ---------------------------------------------------------------------------
revoke all on table public.overtime_requests
  from anon, public, authenticated;
revoke all on table public.overtime_request_history
  from anon, public, authenticated;

grant select on table public.overtime_requests to authenticated;
grant select on table public.overtime_request_history to authenticated;

revoke all on sequence public.overtime_request_history_id_seq
  from anon, public, authenticated;

grant select, insert, update, delete on table public.overtime_requests
  to service_role;
grant select, insert, update, delete on table public.overtime_request_history
  to service_role;
grant usage, select on sequence public.overtime_request_history_id_seq
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Fungsi murni: jam ekuivalen
-- ---------------------------------------------------------------------------
create or replace function public.overtime_equivalent_minutes(
  p_minutes integer,
  p_day_type text
)
returns integer
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select case
    when p_minutes is null or p_minutes <= 0 then 0
    when p_day_type = 'workday' then
      (least(p_minutes, 60) * 1.5
        + greatest(p_minutes - 60, 0) * 2)::integer
    when p_day_type in ('restday', 'holiday') then
      (least(p_minutes, 420) * 2
        + least(greatest(p_minutes - 420, 0), 60) * 3
        + greatest(p_minutes - 480, 0) * 4)::integer
    else 0
  end;
$$;

comment on function public.overtime_equivalent_minutes(integer, text) is
  'Konversi menit lembur ke menit ekuivalen sesuai pola hari kerja/istirahat.';

revoke all on function public.overtime_equivalent_minutes(integer, text)
  from public, anon;
grant execute on function public.overtime_equivalent_minutes(integer, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC: ajukan lembur
-- ---------------------------------------------------------------------------
create or replace function public.submit_overtime_request(
  p_request_date date,
  p_start_time time,
  p_end_time time,
  p_work_description text
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_employee public.employees;
  v_schedule public.work_schedules;
  v_minutes integer;
  v_seconds numeric;
  v_day_type text;
  v_description text;
  v_today date;
  v_week_start date;
  v_week_end date;
  v_daily_used integer := 0;
  v_weekly_used integer := 0;
  v_holiday_name text;
  v_request public.overtime_requests;
begin
  if not public.current_has_role(array['employee']) then
    raise exception 'Akses ditolak: hanya karyawan yang dapat mengajukan lembur'
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
    raise exception 'Karyawan Nonaktif tidak bisa mengajukan lembur'
      using errcode = 'P0001';
  end if;

  if p_request_date is null then
    raise exception 'Tanggal lembur wajib diisi' using errcode = 'P0001';
  end if;
  if p_start_time is null or p_end_time is null then
    raise exception 'Jam mulai dan jam selesai wajib diisi'
      using errcode = 'P0001';
  end if;
  if p_end_time <= p_start_time then
    raise exception 'Jam selesai harus setelah jam mulai (lembur lintas tengah malam tidak didukung)'
      using errcode = 'P0001';
  end if;

  v_seconds := extract(epoch from (p_end_time - p_start_time));
  if mod(v_seconds, 1800) <> 0 then
    raise exception 'Jam lembur harus kelipatan 30 menit'
      using errcode = 'P0001';
  end if;
  v_minutes := (v_seconds / 60)::integer;
  if v_minutes < 30 then
    raise exception 'Minimal lembur 30 menit' using errcode = 'P0001';
  end if;
  if v_minutes > 240 then
    raise exception 'Maksimal lembur 4 jam per hari' using errcode = 'P0001';
  end if;

  v_description := nullif(btrim(coalesce(p_work_description, '')), '');
  if v_description is null then
    raise exception 'Uraian pekerjaan wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_description) > 1000 then
    raise exception 'Uraian pekerjaan maksimal 1000 karakter'
      using errcode = 'P0001';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;
  if p_request_date < v_today - 3 then
    raise exception 'Tanggal lembur paling cepat 3 hari ke belakang'
      using errcode = 'P0001';
  end if;
  if p_request_date > v_today + 14 then
    raise exception 'Tanggal lembur paling lambat 14 hari ke depan'
      using errcode = 'P0001';
  end if;

  select * into v_schedule
  from public.work_schedules
  where is_active
    and (employee_id = v_employee_id or employee_id is null)
  order by employee_id nulls last
  limit 1;

  select name into v_holiday_name
  from public.holidays
  where holiday_date = p_request_date;

  if v_holiday_name is not null then
    v_day_type := 'holiday';
  else
    if v_schedule.id is null then
      raise exception 'Jadwal kerja belum diatur oleh HR'
        using errcode = 'P0001';
    end if;
    if extract(isodow from p_request_date)::smallint = any (v_schedule.work_days) then
      v_day_type := 'workday';
    else
      v_day_type := 'restday';
    end if;
  end if;

  if exists (
    select 1 from public.leave_requests
    where employee_id = v_employee_id
      and status = 'Disetujui'
      and start_date <= p_request_date
      and end_date >= p_request_date
  ) then
    raise exception 'Tanggal tersebut sudah tercakup cuti, sakit, atau izin yang disetujui'
      using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('overtime_employee:' || v_employee_id)::bigint
  );

  if exists (
    select 1 from public.overtime_requests
    where employee_id = v_employee_id
      and request_date = p_request_date
      and status in ('Menunggu', 'Disetujui')
      and start_time < p_end_time
      and end_time > p_start_time
  ) then
    raise exception 'Jam lembur tumpang tindih dengan pengajuan lain'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(
    case
      when status = 'Disetujui' then coalesce(approved_minutes, requested_minutes)
      else requested_minutes
    end
  ), 0) into v_daily_used
  from public.overtime_requests
  where employee_id = v_employee_id
    and request_date = p_request_date
    and status in ('Menunggu', 'Disetujui');

  if v_daily_used + v_minutes > 240 then
    raise exception 'Batas lembur 4 jam per hari terlampaui (% menit sudah dipakai)',
      v_daily_used using errcode = 'P0001';
  end if;

  v_week_start := date_trunc('week', p_request_date::timestamp)::date;
  v_week_end := v_week_start + 6;

  select coalesce(sum(
    case
      when status = 'Disetujui' then coalesce(approved_minutes, requested_minutes)
      else requested_minutes
    end
  ), 0) into v_weekly_used
  from public.overtime_requests
  where employee_id = v_employee_id
    and request_date between v_week_start and v_week_end
    and status in ('Menunggu', 'Disetujui');

  if v_weekly_used + v_minutes > 1080 then
    raise exception 'Batas lembur 18 jam per minggu terlampaui (% menit sudah dipakai)',
      v_weekly_used using errcode = 'P0001';
  end if;

  insert into public.overtime_requests (
    employee_id, request_date, start_time, end_time, requested_minutes,
    day_type, work_description, status
  ) values (
    v_employee_id, p_request_date, p_start_time, p_end_time, v_minutes,
    v_day_type, v_description, 'Menunggu'
  )
  returning * into v_request;

  insert into public.overtime_request_history (
    request_id, employee_id, action, from_status, to_status, reason, actor_id
  ) values (
    v_request.id, v_request.employee_id, 'Diajukan', null, 'Menunggu',
    null, auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.submit_overtime_request(date, time, time, text) is
  'Ajukan lembur: validasi hari, batas harian/mingguan, overlap, cuti, dan riwayat.';

-- ---------------------------------------------------------------------------
-- 7. RPC: batalkan pengajuan sendiri
-- ---------------------------------------------------------------------------
create or replace function public.cancel_overtime_request(p_request_id uuid)
returns public.overtime_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_request public.overtime_requests;
begin
  if not public.current_has_role(array['employee']) then
    raise exception 'Akses ditolak: hanya karyawan yang dapat membatalkan lembur'
      using errcode = '42501';
  end if;

  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    raise exception 'Akun belum tertaut ke data karyawan'
      using errcode = 'P0001';
  end if;

  select * into v_request
  from public.overtime_requests
  where id = p_request_id and employee_id = v_employee_id
  for update;

  if not found then
    raise exception 'Pengajuan lembur tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_request.status <> 'Menunggu' then
    raise exception 'Hanya pengajuan Menunggu yang bisa dibatalkan karyawan'
      using errcode = 'P0001';
  end if;

  update public.overtime_requests
  set status = 'Dibatalkan',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_kind = 'Karyawan'
  where id = v_request.id
  returning * into v_request;

  insert into public.overtime_request_history (
    request_id, employee_id, action, from_status, to_status, actor_id
  ) values (
    v_request.id, v_request.employee_id,
    'Dibatalkan Karyawan', 'Menunggu', 'Dibatalkan', auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.cancel_overtime_request(uuid) is
  'Batalkan lembur milik sendiri yang masih Menunggu.';

-- ---------------------------------------------------------------------------
-- 8. RPC: setujui / tolak
-- ---------------------------------------------------------------------------
create or replace function public.decide_overtime_request(
  p_request_id uuid,
  p_decision text,
  p_approved_minutes integer default null,
  p_reason text default null
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request public.overtime_requests;
  v_decision text;
  v_reason text;
  v_approved integer;
  v_equivalent integer;
  v_daily_used integer := 0;
  v_weekly_used integer := 0;
  v_week_start date;
  v_week_end date;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat memutuskan lembur'
      using errcode = '42501';
  end if;

  v_decision := nullif(btrim(coalesce(p_decision, '')), '');
  if v_decision not in ('Disetujui', 'Ditolak') then
    raise exception 'Keputusan harus Disetujui atau Ditolak'
      using errcode = 'P0001';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_decision = 'Ditolak' and v_reason is null then
    raise exception 'Alasan penolakan wajib diisi' using errcode = 'P0001';
  end if;
  if v_reason is not null and length(v_reason) > 1000 then
    raise exception 'Alasan maksimal 1000 karakter' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.overtime_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pengajuan lembur tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_request.status <> 'Menunggu' then
    raise exception 'Pengajuan sudah diputuskan atau dibatalkan'
      using errcode = 'P0001';
  end if;

  if v_decision = 'Disetujui' then
    if p_approved_minutes is null then
      raise exception 'Jam disetujui wajib diisi' using errcode = 'P0001';
    end if;
    if p_approved_minutes < 30
       or p_approved_minutes > v_request.requested_minutes
       or mod(p_approved_minutes, 30) <> 0 then
      raise exception 'Jam disetujui harus 30–% menit dan kelipatan 30 menit',
        v_request.requested_minutes using errcode = 'P0001';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('overtime_employee:' || v_request.employee_id)::bigint
    );

    if exists (
      select 1 from public.leave_requests
      where employee_id = v_request.employee_id
        and status = 'Disetujui'
        and start_date <= v_request.request_date
        and end_date >= v_request.request_date
    ) then
      raise exception 'Tanggal tersebut sudah tercakup cuti, sakit, atau izin yang disetujui'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.overtime_requests r
      where r.id <> v_request.id
        and r.employee_id = v_request.employee_id
        and r.request_date = v_request.request_date
        and r.status in ('Menunggu', 'Disetujui')
        and r.start_time < v_request.end_time
        and r.end_time > v_request.start_time
    ) then
      raise exception 'Jam lembur tumpang tindih dengan pengajuan lain'
        using errcode = 'P0001';
    end if;

    select coalesce(sum(
      case
        when status = 'Disetujui' then coalesce(approved_minutes, requested_minutes)
        else requested_minutes
      end
    ), 0) into v_daily_used
    from public.overtime_requests
    where employee_id = v_request.employee_id
      and request_date = v_request.request_date
      and id <> v_request.id
      and status in ('Menunggu', 'Disetujui');

    if v_daily_used + p_approved_minutes > 240 then
      raise exception 'Batas lembur 4 jam per hari terlampaui'
        using errcode = 'P0001';
    end if;

    v_week_start := date_trunc('week', v_request.request_date::timestamp)::date;
    v_week_end := v_week_start + 6;

    select coalesce(sum(
      case
        when status = 'Disetujui' then coalesce(approved_minutes, requested_minutes)
        else requested_minutes
      end
    ), 0) into v_weekly_used
    from public.overtime_requests
    where employee_id = v_request.employee_id
      and request_date between v_week_start and v_week_end
      and id <> v_request.id
      and status in ('Menunggu', 'Disetujui');

    if v_weekly_used + p_approved_minutes > 1080 then
      raise exception 'Batas lembur 18 jam per minggu terlampaui'
        using errcode = 'P0001';
    end if;

    v_approved := p_approved_minutes;
    v_equivalent := public.overtime_equivalent_minutes(
      v_approved, v_request.day_type
    );

    update public.overtime_requests
    set status = 'Disetujui',
        approved_minutes = v_approved,
        equivalent_minutes = v_equivalent,
        decided_at = now(),
        decided_by = auth.uid(),
        decision_note = v_reason
    where id = v_request.id
    returning * into v_request;
  else
    update public.overtime_requests
    set status = 'Ditolak',
        decided_at = now(),
        decided_by = auth.uid(),
        decision_note = v_reason
    where id = v_request.id
    returning * into v_request;
  end if;

  insert into public.overtime_request_history (
    request_id, employee_id, action, from_status, to_status, reason, actor_id
  ) values (
    v_request.id, v_request.employee_id, v_decision, 'Menunggu', v_decision,
    v_reason, auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.decide_overtime_request(uuid, text, integer, text) is
  'Setujui/tolak lembur; persetujuan boleh mengurangi jam, menghitung ekuivalen dan menulis riwayat.';

-- ---------------------------------------------------------------------------
-- 9. RPC: batalkan lembur Disetujui oleh HR
-- ---------------------------------------------------------------------------
create or replace function public.cancel_approved_overtime_request(
  p_request_id uuid,
  p_reason text
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request public.overtime_requests;
  v_reason text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat membatalkan lembur'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan pembatalan wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_reason) > 1000 then
    raise exception 'Alasan maksimal 1000 karakter' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.overtime_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pengajuan lembur tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_request.status <> 'Disetujui' then
    raise exception 'Hanya lembur Disetujui yang bisa dibatalkan HR'
      using errcode = 'P0001';
  end if;

  update public.overtime_requests
  set status = 'Dibatalkan',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_kind = 'HR',
      cancellation_reason = v_reason
  where id = v_request.id
  returning * into v_request;

  insert into public.overtime_request_history (
    request_id, employee_id, action, from_status, to_status, reason, actor_id
  ) values (
    v_request.id, v_request.employee_id,
    'Dibatalkan HR', 'Disetujui', 'Dibatalkan', v_reason, auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.cancel_approved_overtime_request(uuid, text) is
  'HR membatalkan lembur Disetujui dengan alasan.';

-- ---------------------------------------------------------------------------
-- 10. EXECUTE fungsi
-- ---------------------------------------------------------------------------
revoke all on function public.submit_overtime_request(date, time, time, text)
  from public, anon;
revoke all on function public.cancel_overtime_request(uuid) from public, anon;
revoke all on function public.decide_overtime_request(uuid, text, integer, text)
  from public, anon;
revoke all on function public.cancel_approved_overtime_request(uuid, text)
  from public, anon;

grant execute on function public.submit_overtime_request(date, time, time, text)
  to authenticated, service_role;
grant execute on function public.cancel_overtime_request(uuid)
  to authenticated, service_role;
grant execute on function public.decide_overtime_request(uuid, text, integer, text)
  to authenticated, service_role;
grant execute on function public.cancel_approved_overtime_request(uuid, text)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
