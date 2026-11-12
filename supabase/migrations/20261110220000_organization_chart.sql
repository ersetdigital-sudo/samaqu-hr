-- =============================================================================
-- 20261110220000_organization_chart.sql
-- Jalur baca aman untuk bagan Struktur Organisasi.
--
-- Karyawan tidak punya akses baca ke tabel employees penuh. Fungsi ini hanya
-- mengembalikan kolom yang boleh tampil di bagan (tanpa NIK/kontak/alamat),
-- dengan cek peran di dalam database:
--   * HR Manager, Admin (superuser), dan Karyawan boleh membaca.
--   * Recruiter ditolak.
-- SECURITY DEFINER + search_path terkunci; EXECUTE dicabut dari anon/public.
-- =============================================================================

create or replace function public.organization_chart()
returns table (
  id text,
  full_name text,
  "position" text,
  department text,
  status text,
  manager_id text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.current_has_role(array['hr_manager', 'employee']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Karyawan yang dapat melihat struktur organisasi'
      using errcode = '42501';
  end if;

  return query
    select e.id, e.full_name, e.position, e.department, e.status, e.manager_id
    from public.employees e
    order by e.full_name;
end;
$$;

comment on function public.organization_chart() is
  'Bagan organisasi read-only: kolom terbatas (tanpa data sensitif), hanya HR Manager/Admin/Karyawan, search_path terkunci.';

revoke all on function public.organization_chart() from public, anon;
grant execute on function public.organization_chart() to authenticated, service_role;

notify pgrst, 'reload schema';
