-- =============================================================================
-- 20261113100000_attendance_recap_settings.sql
-- Attendance Tahap C: pengaturan periode Rekap Kehadiran.
--
--  * Satu baris pengaturan global (id = true).
--  * period_start_day 1..28; 1 = awal bulan s/d akhir bulan,
--    26 = tanggal 26 bulan lalu s/d tanggal 25 bulan berjalan.
--  * Perubahan hanya HR Manager/Admin lewat RPC; siapa & kapan tersimpan.
-- =============================================================================

begin;

create table if not exists public.attendance_recap_settings (
  id boolean primary key default true
    check (id),
  period_start_day smallint not null default 1
    check (period_start_day between 1 and 28),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists attendance_recap_settings_set_updated_at
  on public.attendance_recap_settings;
create trigger attendance_recap_settings_set_updated_at
  before update on public.attendance_recap_settings
  for each row execute function public.set_updated_at();

insert into public.attendance_recap_settings (id, period_start_day)
values (true, 1)
on conflict (id) do nothing;

comment on table public.attendance_recap_settings is
  'Pengaturan periode rekap kehadiran. Satu baris global; perubahan lewat RPC HR.';

alter table public.attendance_recap_settings enable row level security;

drop policy if exists attendance_recap_settings_read
  on public.attendance_recap_settings;
create policy attendance_recap_settings_read
  on public.attendance_recap_settings
  for select to authenticated
  using (public.current_has_role(array['hr_manager', 'employee']));

revoke all on table public.attendance_recap_settings
  from anon, public, authenticated;
grant select on table public.attendance_recap_settings to authenticated;
grant select, insert, update, delete on table public.attendance_recap_settings
  to service_role;

create or replace function public.update_attendance_recap_settings(
  p_period_start_day smallint
)
returns public.attendance_recap_settings
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_settings public.attendance_recap_settings;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengubah periode rekap'
      using errcode = '42501';
  end if;

  if p_period_start_day is null
     or p_period_start_day < 1
     or p_period_start_day > 28 then
    raise exception 'Tanggal mulai periode harus 1–28'
      using errcode = 'P0001';
  end if;

  update public.attendance_recap_settings
  set period_start_day = p_period_start_day,
      updated_by = auth.uid(),
      updated_at = now()
  where id = true
  returning * into v_settings;

  if not found then
    insert into public.attendance_recap_settings (
      id, period_start_day, updated_by
    ) values (
      true, p_period_start_day, auth.uid()
    )
    returning * into v_settings;
  end if;

  return v_settings;
end;
$$;

comment on function public.update_attendance_recap_settings(smallint) is
  'Ubah tanggal mulai periode rekap kehadiran; hanya HR Manager/Admin, aktor dan waktu tersimpan.';

revoke all on function public.update_attendance_recap_settings(smallint)
  from public, anon;
grant execute on function public.update_attendance_recap_settings(smallint)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
