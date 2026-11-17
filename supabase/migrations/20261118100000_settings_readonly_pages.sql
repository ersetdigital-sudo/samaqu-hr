-- =============================================================================
-- 20261118100000_settings_readonly_pages.sql
-- Audit log gabungan (baca-saja) dan status integrasi khusus Admin.
-- Tidak mengubah tabel/RLS yang sudah ada.
-- =============================================================================

create or replace function public.audit_log_events(
  p_module text default null,
  p_from date default null,
  p_to date default null,
  p_actor text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_is_admin boolean;
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_role not in ('admin', 'hr_manager') then
    raise exception 'Akses ditolak: audit log hanya untuk Admin dan HR Manager'
      using errcode = '42501';
  end if;
  v_is_admin := v_role = 'admin';

  return (
    with events(
      occurred_at, module_key, module_label, action_label, object_label,
      actor_id, actor_fallback
    ) as (
      select
        ch.changed_at, 'contracts', 'Kontrak',
        case ch.event
          when 'Dibuat' then 'Kontrak dibuat'
          when 'Diperpanjang' then 'Kontrak diperpanjang'
          when 'Berakhir' then 'Kontrak berakhir'
          else 'Kontrak: ' || ch.event
        end,
        coalesce(e.full_name, ch.employee_id),
        ch.changed_by, null::text
      from public.contract_history ch
      left join public.employees e on e.id = ch.employee_id

      union all
      select
        sh.changed_at, 'employees', 'Karyawan',
        case sh.action
          when 'Reaktivasi' then 'Karyawan diaktifkan kembali'
          when 'Perubahan Status' then
            format('Status %s → %s', sh.from_status, sh.to_status)
          else sh.action
        end,
        coalesce(e.full_name, sh.employee_id),
        sh.changed_by, null::text
      from public.employee_status_history sh
      left join public.employees e on e.id = sh.employee_id

      union all
      select
        ph.recorded_at, 'employees', 'Karyawan',
        case ph.change_type
          when 'Promosi' then 'Promosi jabatan'
          when 'Mutasi' then 'Mutasi karyawan'
          when 'Demosi' then 'Demosi jabatan'
          else 'Perubahan posisi'
        end,
        coalesce(e.full_name, ph.employee_id),
        ph.recorded_by, null::text
      from public.employee_position_history ph
      left join public.employees e on e.id = ph.employee_id

      union all
      select
        ah.changed_at, 'users', 'Pengguna & Peran',
        ah.action || case
          when ah.to_value is not null then ' (' || ah.to_value || ')'
          else ''
        end,
        coalesce(up.full_name, 'Pengguna'),
        ah.changed_by, null::text
      from public.user_access_history ah
      left join public.user_profiles up on up.id = ah.user_id
      where v_is_admin

      union all
      select
        dl.deleted_at, 'users', 'Pengguna & Peran',
        'Akun dihapus',
        coalesce(dl.full_name, 'Pengguna'),
        dl.deleted_by, dl.deleted_by_name
      from public.account_deletion_log dl
      where v_is_admin

      union all
      select
        sh.changed_at, 'recruitment', 'Rekrutmen',
        format('Tahap %s → %s', coalesce(sh.from_stage, '—'), sh.to_stage),
        a.application_number || ' · ' || a.full_name,
        sh.changed_by, null::text
      from public.job_application_stage_history sh
      join public.job_applications a on a.id = sh.application_id

      union all
      select
        dh.changed_at, 'recruitment', 'Rekrutmen',
        case dh.column_name
          when 'full_name' then 'Nama'
          when 'whatsapp' then 'WhatsApp'
          when 'email' then 'Email'
          when 'birth_date' then 'Tanggal lahir'
          when 'city' then 'Kota'
          when 'education' then 'Pendidikan'
          when 'has_admin_experience' then 'Pengalaman admin'
          when 'last_position' then 'Posisi terakhir'
          when 'last_company' then 'Perusahaan terakhir'
          when 'experience_length' then 'Lama pengalaman'
          when 'skills' then 'Keahlian'
          when 'expected_salary' then 'Ekspektasi gaji'
          when 'start_availability' then 'Ketersediaan mulai'
          when 'source' then 'Sumber'
          when 'portfolio_url' then 'Portofolio'
          when 'motivation' then 'Motivasi'
          when 'internal_note' then 'Catatan internal'
          when 'stage' then 'Tahap'
          when 'reviewed_at' then 'Tanggal review'
          else initcap(replace(dh.column_name, '_', ' '))
        end || ' diubah',
        a.application_number || ' · ' || a.full_name,
        dh.changed_by, null::text
      from public.job_application_data_history dh
      join public.job_applications a on a.id = dh.application_id

      union all
      select
        dh.changed_at, 'documents', 'Dokumen',
        format('Dokumen %s: %s', dh.doc_type, dh.action),
        coalesce(e.full_name, dh.employee_id),
        dh.changed_by, null::text
      from public.employee_document_history dh
      left join public.employees e on e.id = dh.employee_id

      union all
      select
        rh.acted_at, 'performance', 'Performance',
        case rh.action
          when 'Dibuat' then 'Review dibuat'
          when 'Draft Disimpan' then 'Draft review disimpan'
          when 'Dikirim' then 'Review dikirim'
          when 'Dikembalikan' then 'Review dikembalikan'
          when 'Disetujui' then 'Review disetujui'
          when 'Dikecualikan' then 'Review dikecualikan'
          else rh.action
        end,
        r.employee_name,
        rh.actor_id, rh.actor_name
      from public.performance_review_history rh
      join public.performance_reviews r on r.id = rh.review_id

      union all
      select
        prh.acted_at, 'payroll', 'Payroll',
        prh.action,
        format('Payroll %s', to_char(pr.period_month, 'YYYY-MM')),
        prh.actor_id, null::text
      from public.payroll_run_history prh
      join public.payroll_runs pr on pr.id = prh.run_id

      union all
      select
        rel.created_at, 'reports', 'Laporan',
        'Ekspor ' || rel.report_label,
        format('%s baris', rel.row_count),
        rel.exported_by, rel.exported_by_name
      from public.report_export_log rel

      union all
      select
        lrh.acted_at, 'leave', 'Cuti & Izin',
        lrh.action,
        coalesce(e.full_name, lrh.employee_id),
        lrh.actor_id, null::text
      from public.leave_request_history lrh
      left join public.employees e on e.id = lrh.employee_id

      union all
      select
        oth.acted_at, 'overtime', 'Lembur',
        oth.action,
        coalesce(e.full_name, oth.employee_id),
        oth.actor_id, null::text
      from public.overtime_request_history oth
      left join public.employees e on e.id = oth.employee_id

      union all
      select
        ac.corrected_at, 'attendance', 'Kehadiran',
        'Koreksi kehadiran',
        coalesce(e.full_name, ac.employee_id) || ' · ' || ac.work_date::text,
        ac.corrected_by, null::text
      from public.attendance_corrections ac
      left join public.employees e on e.id = ac.employee_id
    ),
    enriched as (
      select
        ev.occurred_at,
        ev.module_key,
        ev.module_label,
        ev.action_label,
        ev.object_label,
        coalesce(up.full_name, nullif(ev.actor_fallback, ''), 'Sistem') as actor_name
      from events ev
      left join public.user_profiles up on up.id = ev.actor_id
    ),
    filtered as (
      select *
      from enriched ev
      where (
        nullif(btrim(coalesce(p_module, '')), '') is null
        or btrim(p_module) = 'Semua'
        or ev.module_key = btrim(p_module)
      )
      and (
        p_from is null
        or (ev.occurred_at at time zone 'Asia/Jakarta')::date >= p_from
      )
      and (
        p_to is null
        or (ev.occurred_at at time zone 'Asia/Jakarta')::date <= p_to
      )
      and (
        nullif(btrim(coalesce(p_actor, '')), '') is null
        or ev.actor_name ilike '%' || btrim(p_actor) || '%'
      )
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or concat_ws(' ', ev.module_label, ev.action_label, ev.object_label, ev.actor_name)
          ilike '%' || btrim(p_search) || '%'
      )
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'occurred_at', page.occurred_at,
          'module_key', page.module_key,
          'module_label', page.module_label,
          'action_label', page.action_label,
          'object_label', page.object_label,
          'actor_name', page.actor_name
        ) order by page.occurred_at desc), '[]'::jsonb)
        from (
          select *
          from filtered
          order by occurred_at desc
          limit v_limit
          offset v_offset
        ) page
      )
    )
  );
end;
$$;

comment on function public.audit_log_events(text, date, date, text, text, integer, integer)
  is 'Audit log gabungan lintas modul. Admin penuh; HR tanpa riwayat akses pengguna dan hapus akun.';

revoke all on function public.audit_log_events(text, date, date, text, text, integer, integer)
  from public, anon;
grant execute on function public.audit_log_events(text, date, date, text, text, integer, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Status integrasi khusus Admin.
-- ---------------------------------------------------------------------------
create or replace function public.admin_integration_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Akses ditolak: status integrasi hanya untuk Admin'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'last_cv_deleted_at', (
      select max(cv_deleted_at) from public.job_applications
    )
  );
end;
$$;

revoke all on function public.admin_integration_status() from public, anon;
grant execute on function public.admin_integration_status()
  to authenticated, service_role;

notify pgrst, 'reload schema';
