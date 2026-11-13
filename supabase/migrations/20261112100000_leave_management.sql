-- =============================================================================
-- 20261112100000_leave_management.sql
-- Attendance Tahap B: Cuti & Izin.
--
--  * leave_types: master jenis cuti (mudah ditambah tanpa ubah kode).
--  * leave_requests: pengajuan cuti; semua penulisan lewat RPC SECURITY DEFINER.
--  * leave_request_history: jejak keputusan, SELECT-only untuk authenticated.
--  * Saldo cuti dihitung dari pengajuan Disetujui (tidak pernah diisi manual).
--  * Lampiran di bucket privat `leave-attachments` (PDF/JPG/PNG, maks 4 MB).
--  * Hari kerja mengikuti work_schedules + holidays; melahirkan/keguguran
--    memakai hari kalender.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Master jenis cuti
-- ---------------------------------------------------------------------------
create table if not exists public.leave_types (
  code text primary key
    check (code ~ '^[a-z0-9-]+$'),
  name text not null unique
    check (length(btrim(name)) between 1 and 100),
  category text not null
    check (category in ('annual', 'sick', 'permission', 'special')),
  description text
    check (description is null or length(description) <= 500),
  counts_calendar_days boolean not null default false,
  deducts_annual_balance boolean not null default false,
  annual_entitlement integer
    check (annual_entitlement is null or annual_entitlement between 0 and 365),
  quota_days integer
    check (quota_days is null or quota_days between 1 and 366),
  requires_reason boolean not null default false,
  requires_event_note boolean not null default false,
  requires_doctor_note_after_workdays integer
    check (
      requires_doctor_note_after_workdays is null
      or requires_doctor_note_after_workdays between 1 and 30
    ),
  allow_past_days integer not null default 0
    check (allow_past_days between 0 and 7),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists leave_types_set_updated_at on public.leave_types;
create trigger leave_types_set_updated_at
  before update on public.leave_types
  for each row execute function public.set_updated_at();

insert into public.leave_types (
  code, name, category, description, counts_calendar_days,
  deducts_annual_balance, annual_entitlement, quota_days,
  requires_reason, requires_event_note,
  requires_doctor_note_after_workdays, allow_past_days, sort_order
)
values
  (
    'annual', 'Cuti Tahunan', 'annual',
    '12 hari kerja per tahun kalender. Aktif setelah 12 bulan masa kerja.',
    false, true, 12, null, false, false, null, 0, 10
  ),
  (
    'sick', 'Sakit', 'sick',
    'Tidak mengurangi saldo tahunan. Surat dokter wajib untuk 3 hari kerja atau lebih.',
    false, false, null, null, false, false, 3, 7, 20
  ),
  (
    'permission', 'Izin', 'permission',
    'Tidak mengurangi saldo tahunan. Alasan wajib diisi.',
    false, false, null, null, true, false, null, 7, 30
  ),
  (
    'marriage', 'Menikah', 'special',
    'Cuti khusus 3 hari kerja untuk pernikahan karyawan.',
    false, false, null, 3, false, true, null, 0, 40
  ),
  (
    'marry-child', 'Menikahkan Anak', 'special',
    'Cuti khusus 2 hari kerja untuk menikahkan anak.',
    false, false, null, 2, false, true, null, 0, 41
  ),
  (
    'circumcise-child', 'Mengkhitankan atau Membaptiskan Anak', 'special',
    'Cuti khusus 2 hari kerja untuk mengkhitankan atau membaptiskan anak.',
    false, false, null, 2, false, true, null, 0, 42
  ),
  (
    'wife-childbirth', 'Istri Melahirkan atau Keguguran', 'special',
    'Cuti khusus 2 hari kerja untuk istri melahirkan atau keguguran.',
    false, false, null, 2, false, true, null, 0, 43
  ),
  (
    'immediate-family-death', 'Keluarga Inti Meninggal', 'special',
    'Cuti khusus 2 hari kerja untuk keluarga inti meninggal.',
    false, false, null, 2, false, true, null, 0, 44
  ),
  (
    'household-death', 'Anggota Keluarga Serumah Meninggal', 'special',
    'Cuti khusus 1 hari kerja untuk anggota keluarga serumah meninggal.',
    false, false, null, 1, false, true, null, 0, 45
  ),
  (
    'maternity', 'Melahirkan', 'special',
    'Cuti melahirkan 90 hari kalender.',
    true, false, null, 90, false, true, null, 0, 90
  ),
  (
    'miscarriage', 'Keguguran', 'special',
    'Cuti keguguran 45 hari kalender.',
    true, false, null, 45, false, true, null, 0, 100
  )
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Pengajuan cuti
-- ---------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null
    references public.employees (id) on delete cascade,
  leave_type_code text not null
    references public.leave_types (code) on delete restrict,
  start_date date not null,
  end_date date not null,
  days_count integer not null check (days_count between 1 and 366),
  reason text
    check (reason is null or (length(btrim(reason)) between 1 and 1000)),
  event_note text
    check (event_note is null or (length(btrim(event_note)) between 1 and 500)),
  status text not null default 'Menunggu'
    check (status in ('Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan')),
  attachment_path text unique,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
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
  constraint leave_requests_date_order check (end_date >= start_date),
  constraint leave_requests_attachment_consistency check (
    (
      attachment_path is null
      and attachment_name is null
      and attachment_size is null
      and attachment_mime is null
    )
    or (
      attachment_path is not null
      and attachment_name is not null
      and attachment_size between 1 and 4194304
      and attachment_mime in ('application/pdf', 'image/jpeg', 'image/png')
    )
  )
);

create index if not exists leave_requests_employee_idx
  on public.leave_requests (employee_id, start_date desc);
create index if not exists leave_requests_status_date_idx
  on public.leave_requests (status, start_date);
create index if not exists leave_requests_active_overlap_idx
  on public.leave_requests (employee_id, start_date, end_date)
  where status in ('Menunggu', 'Disetujui');
create index if not exists leave_requests_type_idx
  on public.leave_requests (leave_type_code);

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

comment on table public.leave_requests is
  'Pengajuan cuti/izin. Saldo dihitung dari baris Disetujui; tidak ada saldo manual.';

-- ---------------------------------------------------------------------------
-- 3. Riwayat keputusan (immutable, ditulis RPC)
-- ---------------------------------------------------------------------------
create table if not exists public.leave_request_history (
  id bigserial primary key,
  request_id uuid not null,
  employee_id text not null,
  leave_type_code text not null,
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

create index if not exists leave_request_history_request_idx
  on public.leave_request_history (request_id, acted_at desc);
create index if not exists leave_request_history_employee_idx
  on public.leave_request_history (employee_id, acted_at desc);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_request_history enable row level security;

drop policy if exists leave_types_read on public.leave_types;
create policy leave_types_read on public.leave_types
  for select to authenticated
  using (public.current_has_role(array['hr_manager', 'employee']));

drop policy if exists leave_requests_staff_read on public.leave_requests;
create policy leave_requests_staff_read on public.leave_requests
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists leave_requests_self_read on public.leave_requests;
create policy leave_requests_self_read on public.leave_requests
  for select to authenticated
  using (employee_id = public.current_employee_id());

drop policy if exists leave_request_history_staff_read
  on public.leave_request_history;
create policy leave_request_history_staff_read
  on public.leave_request_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists leave_request_history_self_read
  on public.leave_request_history;
create policy leave_request_history_self_read
  on public.leave_request_history
  for select to authenticated
  using (employee_id = public.current_employee_id());

-- ---------------------------------------------------------------------------
-- 5. Hak tabel: SELECT-only; tulisan hanya lewat RPC
-- ---------------------------------------------------------------------------
revoke all on table public.leave_types
  from anon, public, authenticated;
revoke all on table public.leave_requests
  from anon, public, authenticated;
revoke all on table public.leave_request_history
  from anon, public, authenticated;

grant select on table public.leave_types to authenticated;
grant select on table public.leave_requests to authenticated;
grant select on table public.leave_request_history to authenticated;

revoke all on sequence public.leave_request_history_id_seq
  from anon, public, authenticated;

grant select, insert, update, delete on table public.leave_types to service_role;
grant select, insert, update, delete on table public.leave_requests
  to service_role;
grant select, insert, update, delete on table public.leave_request_history
  to service_role;
grant usage, select on sequence public.leave_request_history_id_seq
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC: ajukan cuti
-- ---------------------------------------------------------------------------
create or replace function public.submit_leave_request(
  p_leave_type_code text,
  p_start_date date,
  p_end_date date,
  p_reason text default null,
  p_event_note text default null,
  p_attachment_path text default null,
  p_attachment_name text default null,
  p_attachment_size bigint default null,
  p_attachment_mime text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_employee public.employees;
  v_type public.leave_types;
  v_schedule public.work_schedules;
  v_today date;
  v_days integer := 0;
  v_cursor date;
  v_used integer := 0;
  v_entitlement integer := 0;
  v_eligible_date date;
  v_reason text;
  v_event_note text;
  v_request public.leave_requests;
begin
  if not public.current_has_role(array['employee']) then
    raise exception 'Akses ditolak: hanya karyawan yang dapat mengajukan cuti'
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
    raise exception 'Karyawan Nonaktif tidak bisa mengajukan cuti'
      using errcode = 'P0001';
  end if;

  select * into v_type
  from public.leave_types
  where code = p_leave_type_code and is_active;

  if not found then
    raise exception 'Jenis cuti tidak ditemukan atau tidak aktif'
      using errcode = 'P0002';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception 'Tanggal mulai dan selesai wajib diisi'
      using errcode = 'P0001';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Tanggal selesai tidak boleh sebelum tanggal mulai'
      using errcode = 'P0001';
  end if;

  v_today := (now() at time zone 'Asia/Jakarta')::date;
  if p_start_date < v_today - v_type.allow_past_days then
    raise exception 'Tanggal mulai paling cepat % hari ke belakang',
      v_type.allow_past_days using errcode = 'P0001';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_type.requires_reason and v_reason is null then
    raise exception 'Alasan wajib diisi untuk jenis cuti ini'
      using errcode = 'P0001';
  end if;
  if v_reason is not null and length(v_reason) > 1000 then
    raise exception 'Alasan maksimal 1000 karakter' using errcode = 'P0001';
  end if;

  v_event_note := nullif(btrim(coalesce(p_event_note, '')), '');
  if v_type.requires_event_note and v_event_note is null then
    raise exception 'Keterangan kejadian wajib diisi untuk cuti khusus ini'
      using errcode = 'P0001';
  end if;
  if v_event_note is not null and length(v_event_note) > 500 then
    raise exception 'Keterangan kejadian maksimal 500 karakter'
      using errcode = 'P0001';
  end if;

  if v_type.counts_calendar_days then
    v_days := (p_end_date - p_start_date) + 1;
  else
    select * into v_schedule
    from public.work_schedules
    where is_active
      and (employee_id = v_employee_id or employee_id is null)
    order by employee_id nulls last
    limit 1;

    if not found then
      raise exception 'Jadwal kerja belum diatur oleh HR'
        using errcode = 'P0001';
    end if;

    v_cursor := p_start_date;
    while v_cursor <= p_end_date loop
      if extract(isodow from v_cursor)::smallint = any (v_schedule.work_days)
         and not exists (
           select 1 from public.holidays
           where holiday_date = v_cursor
         ) then
        v_days := v_days + 1;
      end if;
      v_cursor := v_cursor + 1;
    end loop;

    if v_days = 0 then
      raise exception 'Rentang tanggal tidak mengandung hari kerja'
        using errcode = 'P0001';
    end if;
  end if;

  if v_type.quota_days is not null and v_days > v_type.quota_days then
    raise exception 'Jumlah hari (%) melebihi kuota % hari untuk jenis ini',
      v_days, v_type.quota_days using errcode = 'P0001';
  end if;

  if (
    p_attachment_path is not null
    or p_attachment_name is not null
    or p_attachment_size is not null
    or p_attachment_mime is not null
  ) then
    if p_attachment_path is null
       or p_attachment_name is null
       or p_attachment_size is null
       or p_attachment_mime is null then
      raise exception 'Metadata lampiran tidak lengkap' using errcode = 'P0001';
    end if;
    if p_attachment_path not like v_employee_id || '/%' then
      raise exception 'Lampiran tidak sesuai dengan karyawan'
        using errcode = 'P0001';
    end if;
    if length(p_attachment_name) > 200 then
      raise exception 'Nama lampiran terlalu panjang' using errcode = 'P0001';
    end if;
    if p_attachment_size < 1 or p_attachment_size > 4194304 then
      raise exception 'Ukuran lampiran maksimal 4 MB' using errcode = 'P0001';
    end if;
    if p_attachment_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
      raise exception 'Lampiran harus PDF, JPG, atau PNG'
        using errcode = 'P0001';
    end if;
  end if;

  if v_type.requires_doctor_note_after_workdays is not null
     and v_days >= v_type.requires_doctor_note_after_workdays
     and p_attachment_path is null then
    raise exception 'Surat dokter wajib dilampirkan untuk sakit 3 hari kerja atau lebih'
      using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('leave_employee:' || v_employee_id)::bigint
  );

  if exists (
    select 1 from public.leave_requests
    where employee_id = v_employee_id
      and status in ('Menunggu', 'Disetujui')
      and start_date <= p_end_date
      and end_date >= p_start_date
  ) then
    raise exception 'Rentang tanggal tumpang tindih dengan pengajuan lain yang masih Menunggu atau Disetujui'
      using errcode = 'P0001';
  end if;

  if v_type.deducts_annual_balance then
    if extract(year from p_start_date) <> extract(year from p_end_date) then
      raise exception 'Cuti tahunan harus berada dalam satu tahun kalender'
        using errcode = 'P0001';
    end if;

    v_eligible_date := (v_employee.joined_at + interval '12 months')::date;
    if v_employee.status <> 'Aktif' or p_start_date < v_eligible_date then
      raise exception 'Hak cuti tahunan belum aktif. Hak aktif setelah 12 bulan masa kerja dan status Aktif'
        using errcode = 'P0001';
    end if;

    v_entitlement := coalesce(v_type.annual_entitlement, 0);
    select coalesce(sum(r.days_count), 0) into v_used
    from public.leave_requests r
    join public.leave_types lt on lt.code = r.leave_type_code
    where r.employee_id = v_employee_id
      and r.status = 'Disetujui'
      and lt.deducts_annual_balance
      and extract(year from r.start_date) = extract(year from p_start_date);

    if v_days > v_entitlement - v_used then
      raise exception 'Sisa saldo cuti tahunan tidak cukup (% hari tersisa)',
        greatest(v_entitlement - v_used, 0) using errcode = 'P0001';
    end if;
  end if;

  insert into public.leave_requests (
    employee_id, leave_type_code, start_date, end_date, days_count,
    reason, event_note, status,
    attachment_path, attachment_name, attachment_size, attachment_mime
  ) values (
    v_employee_id, v_type.code, p_start_date, p_end_date, v_days,
    v_reason, v_event_note, 'Menunggu',
    p_attachment_path, p_attachment_name, p_attachment_size, p_attachment_mime
  )
  returning * into v_request;

  insert into public.leave_request_history (
    request_id, employee_id, leave_type_code,
    action, from_status, to_status, reason, actor_id
  ) values (
    v_request.id, v_request.employee_id, v_request.leave_type_code,
    'Diajukan', null, 'Menunggu', v_reason, auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.submit_leave_request(
  text, date, date, text, text, text, text, bigint, text
) is
  'Ajukan cuti/izin: validasi tanggal, hari kerja, saldo/kuota, tumpang tindih, lampiran; menulis pengajuan + riwayat dalam satu transaksi.';

-- ---------------------------------------------------------------------------
-- 7. RPC: batalkan pengajuan sendiri
-- ---------------------------------------------------------------------------
create or replace function public.cancel_leave_request(p_request_id uuid)
returns public.leave_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_request public.leave_requests;
begin
  if not public.current_has_role(array['employee']) then
    raise exception 'Akses ditolak: hanya karyawan yang dapat membatalkan pengajuan'
      using errcode = '42501';
  end if;

  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    raise exception 'Akun belum tertaut ke data karyawan'
      using errcode = 'P0001';
  end if;

  select * into v_request
  from public.leave_requests
  where id = p_request_id and employee_id = v_employee_id
  for update;

  if not found then
    raise exception 'Pengajuan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_request.status <> 'Menunggu' then
    raise exception 'Hanya pengajuan Menunggu yang bisa dibatalkan karyawan'
      using errcode = 'P0001';
  end if;

  update public.leave_requests
  set status = 'Dibatalkan',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_kind = 'Karyawan'
  where id = v_request.id
  returning * into v_request;

  insert into public.leave_request_history (
    request_id, employee_id, leave_type_code,
    action, from_status, to_status, actor_id
  ) values (
    v_request.id, v_request.employee_id, v_request.leave_type_code,
    'Dibatalkan Karyawan', 'Menunggu', 'Dibatalkan', auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.cancel_leave_request(uuid) is
  'Batalkan pengajuan milik sendiri yang masih Menunggu; menulis riwayat dalam transaksi yang sama.';

-- ---------------------------------------------------------------------------
-- 8. RPC: setujui / tolak (HR Manager & Admin)
-- ---------------------------------------------------------------------------
create or replace function public.decide_leave_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request public.leave_requests;
  v_type public.leave_types;
  v_employee public.employees;
  v_decision text;
  v_reason text;
  v_used integer := 0;
  v_entitlement integer := 0;
  v_eligible_date date;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat memutuskan cuti'
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
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pengajuan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_request.status <> 'Menunggu' then
    raise exception 'Pengajuan sudah diputuskan atau dibatalkan'
      using errcode = 'P0001';
  end if;

  select * into v_type
  from public.leave_types
  where code = v_request.leave_type_code;

  if not found then
    raise exception 'Jenis cuti tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_decision = 'Disetujui' then
    select * into v_employee
    from public.employees
    where id = v_request.employee_id
    for update;

    if not found then
      raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
    end if;
    if v_employee.status not in ('Aktif', 'Probation') then
      raise exception 'Karyawan sudah Nonaktif; pengajuan tidak bisa disetujui'
        using errcode = 'P0001';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('leave_employee:' || v_request.employee_id)::bigint
    );

    if exists (
      select 1 from public.leave_requests r
      where r.id <> v_request.id
        and r.employee_id = v_request.employee_id
        and r.status in ('Menunggu', 'Disetujui')
        and r.start_date <= v_request.end_date
        and r.end_date >= v_request.start_date
    ) then
      raise exception 'Terdapat pengajuan lain yang tumpang tindih untuk karyawan ini'
        using errcode = 'P0001';
    end if;

    if v_type.quota_days is not null
       and v_request.days_count > v_type.quota_days then
      raise exception 'Jumlah hari melebihi kuota jenis cuti ini'
        using errcode = 'P0001';
    end if;

    if v_type.deducts_annual_balance then
      v_eligible_date := (v_employee.joined_at + interval '12 months')::date;
      if v_employee.status <> 'Aktif'
         or v_request.start_date < v_eligible_date then
        raise exception 'Hak cuti tahunan karyawan belum aktif'
          using errcode = 'P0001';
      end if;

      v_entitlement := coalesce(v_type.annual_entitlement, 0);
      select coalesce(sum(r.days_count), 0) into v_used
      from public.leave_requests r
      join public.leave_types lt on lt.code = r.leave_type_code
      where r.employee_id = v_request.employee_id
        and r.id <> v_request.id
        and r.status = 'Disetujui'
        and lt.deducts_annual_balance
        and extract(year from r.start_date) = extract(year from v_request.start_date);

      if v_request.days_count > v_entitlement - v_used then
        raise exception 'Sisa saldo cuti tahunan tidak cukup saat persetujuan'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  update public.leave_requests
  set status = v_decision,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_note = v_reason
  where id = v_request.id
  returning * into v_request;

  insert into public.leave_request_history (
    request_id, employee_id, leave_type_code,
    action, from_status, to_status, reason, actor_id
  ) values (
    v_request.id, v_request.employee_id, v_request.leave_type_code,
    v_decision, 'Menunggu', v_decision, v_reason, auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.decide_leave_request(uuid, text, text) is
  'Setujui/tolak pengajuan Menunggu. Validasi ulang saldo, kuota, dan tumpang tindih; menulis riwayat.';

-- ---------------------------------------------------------------------------
-- 9. RPC: batalkan pengajuan Disetujui (HR)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_approved_leave_request(
  p_request_id uuid,
  p_reason text
)
returns public.leave_requests
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_request public.leave_requests;
  v_reason text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat membatalkan cuti'
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
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pengajuan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_request.status <> 'Disetujui' then
    raise exception 'Hanya pengajuan Disetujui yang bisa dibatalkan HR'
      using errcode = 'P0001';
  end if;

  update public.leave_requests
  set status = 'Dibatalkan',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_kind = 'HR',
      cancellation_reason = v_reason
  where id = v_request.id
  returning * into v_request;

  insert into public.leave_request_history (
    request_id, employee_id, leave_type_code,
    action, from_status, to_status, reason, actor_id
  ) values (
    v_request.id, v_request.employee_id, v_request.leave_type_code,
    'Dibatalkan HR', 'Disetujui', 'Dibatalkan', v_reason, auth.uid()
  );

  return v_request;
end;
$$;

comment on function public.cancel_approved_leave_request(uuid, text) is
  'HR membatalkan pengajuan Disetujui dengan alasan; saldo otomatis kembali karena dihitung dari status.';

-- ---------------------------------------------------------------------------
-- 10. RPC: saldo cuti tahunan
-- ---------------------------------------------------------------------------
create or replace function public.leave_balances(p_year integer default null)
returns table (
  employee_id text,
  full_name text,
  department text,
  job_position text,
  status text,
  joined_at date,
  entitlement integer,
  used integer,
  remaining integer,
  eligible boolean,
  eligible_date date
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_year integer;
  v_today date;
  v_staff boolean;
  v_employee_id text;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;
  v_year := coalesce(p_year, extract(year from v_today)::integer);

  if v_year < 2000 or v_year > 2100 then
    raise exception 'Tahun tidak valid' using errcode = 'P0001';
  end if;

  v_staff := public.current_has_role(array['hr_manager']);
  v_employee_id := public.current_employee_id();

  if not v_staff and v_employee_id is null then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.full_name,
    e.department,
    e.position,
    e.status,
    e.joined_at,
    coalesce(t.annual_entitlement, 0)::integer,
    coalesce(u.used, 0)::integer,
    (coalesce(t.annual_entitlement, 0) - coalesce(u.used, 0))::integer,
    (e.status = 'Aktif'
      and (e.joined_at + interval '12 months')::date <= v_today),
    (e.joined_at + interval '12 months')::date
  from public.employees e
  left join public.leave_types t
    on t.code = 'annual' and t.is_active
  left join lateral (
    select sum(r.days_count) as used
    from public.leave_requests r
    join public.leave_types lt on lt.code = r.leave_type_code
    where r.employee_id = e.id
      and r.status = 'Disetujui'
      and lt.deducts_annual_balance
      and extract(year from r.start_date) = v_year
  ) u on true
  where v_staff or e.id = v_employee_id
  order by e.full_name;
end;
$$;

comment on function public.leave_balances(integer) is
  'Saldo cuti tahunan dari pengajuan Disetujui. Staf melihat semua; karyawan hanya dirinya.';

-- ---------------------------------------------------------------------------
-- 11. EXECUTE fungsi
-- ---------------------------------------------------------------------------
revoke all on function public.submit_leave_request(
  text, date, date, text, text, text, text, bigint, text
) from public, anon;
revoke all on function public.cancel_leave_request(uuid) from public, anon;
revoke all on function public.decide_leave_request(uuid, text, text)
  from public, anon;
revoke all on function public.cancel_approved_leave_request(uuid, text)
  from public, anon;
revoke all on function public.leave_balances(integer) from public, anon;

grant execute on function public.submit_leave_request(
  text, date, date, text, text, text, text, bigint, text
) to authenticated, service_role;
grant execute on function public.cancel_leave_request(uuid)
  to authenticated, service_role;
grant execute on function public.decide_leave_request(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.cancel_approved_leave_request(uuid, text)
  to authenticated, service_role;
grant execute on function public.leave_balances(integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Bucket lampiran privat (tanpa policy = hanya lewat API server)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leave-attachments',
  'leave-attachments',
  false,
  4194304,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

notify pgrst, 'reload schema';
