-- =============================================================================
-- 20261114180000_reports_module.sql
-- Modul Laporan: log ekspor, guard akses database, agregat HR, ekspor karyawan.
--
--  * report_export_log hanya SELECT untuk HR/Admin; INSERT lewat fungsi.
--  * Semua laporan diperiksa hak aksesnya di database.
--  * Tidak ada perubahan data modul lain.
-- =============================================================================

create table if not exists public.report_export_log (
  id uuid primary key default gen_random_uuid(),
  report_type text not null
    check (report_type in (
      'hr', 'recruitment', 'attendance', 'payroll', 'performance',
      'employee_export'
    )),
  report_label text not null check (length(btrim(report_label)) between 1 and 160),
  filter_summary text not null default '' check (length(filter_summary) <= 1000),
  row_count integer not null check (row_count >= 0 and row_count <= 10000),
  exported_by uuid references auth.users (id) on delete set null,
  exported_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists report_export_log_created_idx
  on public.report_export_log (created_at desc);
create index if not exists report_export_log_type_idx
  on public.report_export_log (report_type, created_at desc);

alter table public.report_export_log enable row level security;

drop policy if exists report_export_log_staff_read on public.report_export_log;
create policy report_export_log_staff_read
  on public.report_export_log for select to authenticated
  using (public.current_has_role(array['hr_manager']));

revoke all on public.report_export_log from anon, authenticated;
grant select on public.report_export_log to authenticated;
grant select, insert, update, delete on public.report_export_log to service_role;

-- ---------------------------------------------------------------------------
-- Guard akses laporan (dipakai laporan yang memakai service/RLS modul lain)
-- ---------------------------------------------------------------------------
create or replace function public.report_assert_access(p_report_type text)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_report_type is null or p_report_type not in (
    'hr', 'recruitment', 'attendance', 'payroll', 'performance',
    'employee_export', 'export_history'
  ) then
    raise exception 'Jenis laporan tidak valid' using errcode = 'P0001';
  end if;

  if public.current_has_role(array['hr_manager']) then
    return;
  end if;

  if public.current_app_role() = 'recruiter'
    and p_report_type = 'recruitment' then
    return;
  end if;

  raise exception 'Akses ditolak: laporan ini tidak tersedia untuk peran Anda'
    using errcode = '42501';
end;
$$;

comment on function public.report_assert_access(text) is
  'Cek akses laporan di database: HR/Admin semua, recruiter hanya rekrutmen.';

revoke all on function public.report_assert_access(text) from public, anon;
grant execute on function public.report_assert_access(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Log ekspor (dicatat sebelum file dikirim)
-- ---------------------------------------------------------------------------
create or replace function public.log_report_export(
  p_report_type text,
  p_report_label text,
  p_filter_summary text,
  p_row_count integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_id uuid;
  v_label text;
  v_filter text;
  v_actor_name text;
begin
  perform public.report_assert_access(p_report_type);
  if p_report_type = 'export_history' then
    raise exception 'Riwayat ekspor tidak dapat diekspor'
      using errcode = 'P0001';
  end if;

  v_label := nullif(btrim(coalesce(p_report_label, '')), '');
  if v_label is null then
    raise exception 'Nama laporan ekspor wajib diisi' using errcode = 'P0001';
  end if;
  v_filter := btrim(coalesce(p_filter_summary, ''));
  if length(v_filter) > 1000 then
    raise exception 'Ringkasan filter maksimal 1000 karakter'
      using errcode = 'P0001';
  end if;
  if p_row_count is null or p_row_count < 0 or p_row_count > 10000 then
    raise exception 'Jumlah baris ekspor harus antara 0 dan 10000'
      using errcode = 'P0001';
  end if;

  select coalesce(full_name, 'Sistem') into v_actor_name
  from public.user_profiles where id = auth.uid();

  insert into public.report_export_log (
    report_type, report_label, filter_summary, row_count,
    exported_by, exported_by_name
  ) values (
    p_report_type, v_label, v_filter, p_row_count,
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.log_report_export(text, text, text, integer) is
  'Catat ekspor laporan. Recruiter hanya boleh mencatat ekspor rekrutmen.';

revoke all on function public.log_report_export(text, text, text, integer)
  from public, anon;
grant execute on function public.log_report_export(text, text, text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Laporan HR (karyawan, kontrak, dokumen)
-- ---------------------------------------------------------------------------
create or replace function public.report_hr_summary(p_reference_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_ref date := coalesce(p_reference_date, current_date);
  v_month_start date := date_trunc('month', coalesce(p_reference_date, current_date))::date;
  v_month_end date := (date_trunc('month', coalesce(p_reference_date, current_date))
    + interval '1 month -1 day')::date;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: laporan HR hanya untuk HR Manager dan Admin'
      using errcode = '42501';
  end if;

  return (
    with latest_status as (
      select distinct on (employee_id)
        employee_id, to_status, changed_at
      from public.employee_status_history
      order by employee_id, changed_at desc
    )
    select jsonb_build_object(
      'reference_date', v_ref,
      'counts', jsonb_build_object(
        'active', (select count(*) from public.employees where status = 'Aktif'),
        'probation', (select count(*) from public.employees where status = 'Probation'),
        'inactive', (select count(*) from public.employees where status = 'Nonaktif'),
        'new_this_month', (
          select count(*) from public.employees
          where joined_at between v_month_start and v_month_end
        ),
        'left_this_month', (
          select count(*) from latest_status
          where to_status = 'Nonaktif'
            and (changed_at at time zone 'Asia/Jakarta')::date
              between v_month_start and v_month_end
        )
      ),
      'by_status', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'status', status, 'total', total
        ) order by status), '[]'::jsonb)
        from (
          select status, count(*)::int as total
          from public.employees group by status
        ) s
      ),
      'by_department', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'department', department,
          'total', total,
          'active', active,
          'probation', probation,
          'inactive', inactive
        ) order by total desc, department), '[]'::jsonb)
        from (
          select department,
                 count(*)::int as total,
                 count(*) filter (where status = 'Aktif')::int as active,
                 count(*) filter (where status = 'Probation')::int as probation,
                 count(*) filter (where status = 'Nonaktif')::int as inactive
          from public.employees group by department
        ) d
      ),
      'by_employment_type', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'employment_type', employment_type, 'total', total
        ) order by employment_type), '[]'::jsonb)
        from (
          select employment_type, count(*)::int as total
          from public.employees group by employment_type
        ) t
      ),
      'monthly', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'month_start', month_start,
          'new_count', new_count,
          'left_count', left_count
        ) order by month_start), '[]'::jsonb)
        from (
          select
            gs::date as month_start,
            (
              select count(*)::int from public.employees e
              where e.joined_at >= gs::date
                and e.joined_at < (gs + interval '1 month')::date
            ) as new_count,
            (
              select count(*)::int from latest_status ls
              where ls.to_status = 'Nonaktif'
                and (ls.changed_at at time zone 'Asia/Jakarta')::date >= gs::date
                and (ls.changed_at at time zone 'Asia/Jakarta')::date
                  < (gs + interval '1 month')::date
            ) as left_count
          from generate_series(
            date_trunc('month', v_ref) - interval '11 months',
            date_trunc('month', v_ref),
            interval '1 month'
          ) gs
        ) m
      ),
      'contracts', jsonb_build_object(
        'd30', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'employee_name', e.full_name,
            'department', e.department, 'end_date', c.end_date
          ) order by c.end_date, e.full_name), '[]'::jsonb)
          from public.contracts c
          join public.employees e on e.id = c.employee_id
          where c.status = 'Aktif'
            and e.status <> 'Nonaktif'
            and c.end_date between v_ref and v_ref + 30
        ),
        'd60', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'employee_name', e.full_name,
            'department', e.department, 'end_date', c.end_date
          ) order by c.end_date, e.full_name), '[]'::jsonb)
          from public.contracts c
          join public.employees e on e.id = c.employee_id
          where c.status = 'Aktif'
            and e.status <> 'Nonaktif'
            and c.end_date between v_ref + 31 and v_ref + 60
        ),
        'd90', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'employee_name', e.full_name,
            'department', e.department, 'end_date', c.end_date
          ) order by c.end_date, e.full_name), '[]'::jsonb)
          from public.contracts c
          join public.employees e on e.id = c.employee_id
          where c.status = 'Aktif'
            and e.status <> 'Nonaktif'
            and c.end_date between v_ref + 61 and v_ref + 90
        )
      ),
      'documents', jsonb_build_object(
        'expiring', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'employee_name', e.full_name,
            'department', e.department, 'doc_type', d.doc_type,
            'title', coalesce(d.title, d.file_name), 'valid_until', d.valid_until
          ) order by d.valid_until, e.full_name), '[]'::jsonb)
          from public.employee_documents d
          join public.employees e on e.id = d.employee_id
          where d.valid_until between v_ref and v_ref + 30
            and e.status <> 'Nonaktif'
        ),
        'expired', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'employee_name', e.full_name,
            'department', e.department, 'doc_type', d.doc_type,
            'title', coalesce(d.title, d.file_name), 'valid_until', d.valid_until
          ) order by d.valid_until, e.full_name), '[]'::jsonb)
          from public.employee_documents d
          join public.employees e on e.id = d.employee_id
          where d.valid_until < v_ref
            and e.status <> 'Nonaktif'
        )
      )
    )
  );
end;
$$;

comment on function public.report_hr_summary(date) is
  'Ringkasan laporan HR per tanggal acuan: status, departemen, kontrak, dokumen.';

revoke all on function public.report_hr_summary(date) from public, anon;
grant execute on function public.report_hr_summary(date)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ekspor Daftar Karyawan (kolom aman saja)
-- ---------------------------------------------------------------------------
create or replace function public.report_employee_export(
  p_status text,
  p_department text
)
returns table (
  employee_id text,
  full_name text,
  department text,
  job_position text,
  manager_name text,
  status text,
  employment_type text,
  location text,
  joined_at date
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: ekspor karyawan hanya untuk HR Manager dan Admin'
      using errcode = '42501';
  end if;

  return query
  select
    e.id,
    e.full_name,
    e.department,
    e.position,
    m.full_name,
    e.status,
    e.employment_type,
    e.location,
    e.joined_at
  from public.employees e
  left join public.employees m on m.id = e.manager_id
  where (
    p_status is null or btrim(p_status) = '' or btrim(p_status) = 'Semua'
    or e.status = btrim(p_status)
  )
  and (
    p_department is null or btrim(p_department) = ''
    or btrim(p_department) = 'Semua'
    or e.department = btrim(p_department)
  )
  order by e.full_name;
end;
$$;

revoke all on function public.report_employee_export(text, text)
  from public, anon;
grant execute on function public.report_employee_export(text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
