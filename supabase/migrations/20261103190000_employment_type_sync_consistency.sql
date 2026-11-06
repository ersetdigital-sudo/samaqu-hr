-- =============================================================================
-- 20261103190000_employment_type_sync_consistency.sql
-- Konsistensi jenis hubungan kerja antara karyawan dan kontraknya.
--
-- Temuan audit: `sync_employee_employment_type` hanya mengubah
-- `employees.employment_type`. Bila karyawan punya lebih dari satu kontrak
-- Aktif (periode berbeda), kontrak lain tetap memakai jenis lama sehingga
-- data Direktori dan kontrak bisa berbeda.
--
-- Perbaikan: jalur resmi ini ikut menyelaraskan seluruh kontrak Aktif milik
-- karyawan tersebut. Periode kontrak TIDAK diubah; setiap kontrak yang
-- berubah tetap tercatat oleh trigger audit `contracts_log_change`.
-- =============================================================================

begin;

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

  if emp.employment_type is distinct from p_new_type then
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
  end if;

  -- Selaraskan kontrak Aktif lain milik karyawan yang sama (periode tetap).
  update public.contracts
  set employment_type = p_new_type
  where employee_id = p_employee_id
    and status = 'Aktif'
    and employment_type <> p_new_type;

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
  'Jalur resmi perubahan jenis hubungan kerja: sinkron ke employees + seluruh kontrak Aktif, tercatat di contract_history.';

commit;

notify pgrst, 'reload schema';
