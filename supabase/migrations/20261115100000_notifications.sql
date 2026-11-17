-- =============================================================================
-- 20261115100000_notifications.sql
-- Notifikasi in-app dihitung dari data sumber, tanpa tabel notifikasi.
-- Preferensi kategori per akun disimpan di user_notification_prefs.
-- =============================================================================

create table if not exists public.user_notification_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'leave_pending',
    'overtime_pending',
    'contracts_expiring',
    'documents_expiring',
    'performance_reviews_pending',
    'performance_period_overdue',
    'payroll_unpaid',
    'applicants_new_24h',
    'interviews_today',
    'performance_reviews_to_fill',
    'my_leave_decisions',
    'my_overtime_decisions'
  )),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

drop trigger if exists user_notification_prefs_set_updated_at
  on public.user_notification_prefs;
create trigger user_notification_prefs_set_updated_at
  before update on public.user_notification_prefs
  for each row execute function public.set_updated_at();

alter table public.user_notification_prefs enable row level security;

drop policy if exists user_notification_prefs_select
  on public.user_notification_prefs;
create policy user_notification_prefs_select
  on public.user_notification_prefs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_notification_prefs_insert
  on public.user_notification_prefs;
create policy user_notification_prefs_insert
  on public.user_notification_prefs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_notification_prefs_update
  on public.user_notification_prefs;
create policy user_notification_prefs_update
  on public.user_notification_prefs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_notification_prefs_delete
  on public.user_notification_prefs;
create policy user_notification_prefs_delete
  on public.user_notification_prefs for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.user_notification_prefs from anon, public, authenticated;
grant select, insert, update, delete on public.user_notification_prefs
  to authenticated;
grant select, insert, update, delete on public.user_notification_prefs
  to service_role;

-- ---------------------------------------------------------------------------
-- Notifikasi saat ini untuk user yang login.
-- p_include_disabled = true dipakai halaman Settings agar kategori nonaktif
-- tetap tampil beserta jumlahnya.
-- ---------------------------------------------------------------------------
create or replace function public.notifications_for_current_user(
  p_include_disabled boolean default false
)
returns table (
  category text,
  title text,
  detail text,
  href text,
  item_count integer,
  enabled boolean,
  sort_order integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_role text := public.current_app_role();
  v_employee text := public.current_employee_id();
  v_is_staff boolean;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if v_role is null then
    raise exception 'Akses ditolak: akun tidak memiliki peran aktif'
      using errcode = '42501';
  end if;

  v_is_staff := v_role in ('admin', 'hr_manager');

  return query
  with base(
    category, title, detail, href, item_count, allowed, sort_order
  ) as (
    select
      'leave_pending',
      'Cuti & izin menunggu persetujuan',
      format('%s pengajuan menunggu persetujuan', count(*)),
      '/attendance/cuti',
      count(*)::int,
      v_is_staff,
      10
    from public.leave_requests
    where v_is_staff and status = 'Menunggu'

    union all
    select
      'overtime_pending',
      'Lembur menunggu persetujuan',
      format('%s pengajuan lembur menunggu', count(*)),
      '/attendance/lembur',
      count(*)::int,
      v_is_staff,
      20
    from public.overtime_requests
    where v_is_staff and status = 'Menunggu'

    union all
    select
      'contracts_expiring',
      'Kontrak akan berakhir',
      format('%s kontrak berakhir dalam 30 hari', count(*)),
      '/employees/kontrak',
      count(*)::int,
      v_is_staff,
      30
    from public.contracts c
    join public.employees e on e.id = c.employee_id
    where v_is_staff
      and c.status = 'Aktif'
      and e.status <> 'Nonaktif'
      and c.end_date between v_today and v_today + 30

    union all
    select
      'documents_expiring',
      'Dokumen karyawan perlu diperbarui',
      format('%s dokumen kedaluwarsa atau hampir habis', count(*)),
      '/employees/dokumen',
      count(*)::int,
      v_is_staff,
      40
    from public.employee_documents d
    join public.employees e on e.id = d.employee_id
    where v_is_staff
      and e.status <> 'Nonaktif'
      and d.valid_until is not null
      and d.valid_until <= v_today + 30

    union all
    select
      'performance_reviews_pending',
      'Review kinerja menunggu persetujuan',
      format('%s lembar Dikirim menunggu review HR', count(*)),
      '/performance/periode',
      count(*)::int,
      v_is_staff,
      50
    from public.performance_reviews r
    join public.performance_periods p on p.id = r.period_id
    where v_is_staff
      and p.status = 'Terbuka'
      and r.status = 'Dikirim'

    union all
    select
      'performance_period_overdue',
      'Periode penilaian melewati batas',
      format('%s periode lewat jatuh tempo dan belum final', count(*)),
      '/performance/periode',
      count(*)::int,
      v_is_staff,
      60
    from public.performance_periods p
    where v_is_staff
      and p.status = 'Terbuka'
      and p.due_date < v_today
      and exists (
        select 1 from public.performance_reviews r
        where r.period_id = p.id
          and r.status not in ('Final', 'Dikecualikan')
      )

    union all
    select
      'payroll_unpaid',
      'Payroll belum dibayar',
      format('%s run Draft/Final belum dibayar', count(*)),
      '/payroll',
      count(*)::int,
      v_is_staff,
      70
    from public.payroll_runs
    where v_is_staff and status in ('Draft', 'Final')

    union all
    select
      'applicants_new_24h',
      'Pelamar baru 24 jam terakhir',
      format('%s pelamar baru', count(*)),
      '/recruitment/kandidat',
      count(*)::int,
      v_is_staff or v_role = 'recruiter',
      80
    from public.job_applications
    where (v_is_staff or v_role = 'recruiter')
      and created_at >= now() - interval '24 hours'

    union all
    select
      'interviews_today',
      'Wawancara hari ini',
      format('%s wawancara dijadwalkan hari ini', count(*)),
      '/recruitment/jadwal',
      count(*)::int,
      v_is_staff or v_role = 'recruiter',
      90
    from public.interviews
    where (v_is_staff or v_role = 'recruiter')
      and status = 'Dijadwalkan'
      and (scheduled_at at time zone 'Asia/Jakarta')::date = v_today

    union all
    select
      'performance_reviews_to_fill',
      'Penilaian tim perlu diisi',
      format('%s lembar menunggu diisi', count(*)),
      '/performance/tim',
      count(*)::int,
      (v_role = 'employee' or v_is_staff) and v_employee is not null,
      100
    from public.performance_reviews r
    join public.performance_periods p on p.id = r.period_id
    where (v_role = 'employee' or v_is_staff)
      and v_employee is not null
      and r.reviewer_employee_id = v_employee
      and p.status = 'Terbuka'
      and r.status in ('Draft', 'Dikembalikan')

    union all
    select
      'my_leave_decisions',
      'Keputusan cuti/izin terbaru',
      format('%s keputusan dalam 7 hari terakhir', count(*)),
      '/absensi/cuti',
      count(*)::int,
      v_role = 'employee' and v_employee is not null,
      110
    from public.leave_requests
    where v_role = 'employee'
      and v_employee is not null
      and employee_id = v_employee
      and status in ('Disetujui', 'Ditolak')
      and decided_at >= now() - interval '7 days'

    union all
    select
      'my_overtime_decisions',
      'Keputusan lembur terbaru',
      format('%s keputusan dalam 7 hari terakhir', count(*)),
      '/absensi/lembur',
      count(*)::int,
      v_role = 'employee' and v_employee is not null,
      120
    from public.overtime_requests
    where v_role = 'employee'
      and v_employee is not null
      and employee_id = v_employee
      and status in ('Disetujui', 'Ditolak')
      and decided_at >= now() - interval '7 days'
  ),
  prefs as (
    select p.category, p.enabled
    from public.user_notification_prefs p
    where p.user_id = auth.uid()
  )
  select
    b.category,
    b.title,
    b.detail,
    b.href,
    b.item_count,
    coalesce(p.enabled, true) as enabled,
    b.sort_order
  from base b
  left join prefs p on p.category = b.category
  where b.allowed
    and (coalesce(p.enabled, true) or p_include_disabled)
    and (b.item_count > 0 or p_include_disabled)
  order by b.sort_order;
end;
$$;

comment on function public.notifications_for_current_user(boolean) is
  'Notifikasi in-app sesuai peran. Hanya kategori yang diizinkan dan aktif.';

revoke all on function public.notifications_for_current_user(boolean)
  from public, anon;
grant execute on function public.notifications_for_current_user(boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
