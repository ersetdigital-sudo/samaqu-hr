-- Tautan satu kali dari lamaran yang diterima ke karyawan.
alter table public.job_applications
  add column if not exists employee_id text;

alter table public.job_applications
  drop constraint if exists job_applications_employee_id_fkey;

alter table public.job_applications
  add constraint job_applications_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete set null;

create unique index if not exists job_applications_employee_id_key
  on public.job_applications (employee_id)
  where employee_id is not null;

-- Tautan hanya boleh dibuat lewat fungsi konversi (bukan update biasa).
create or replace function public.guard_job_application_employee_link()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if new.employee_id is not null
     and new.employee_id is distinct from old.employee_id
     and coalesce(current_setting('samaqu.employee_conversion', true), '') <> 'on'
  then
    raise exception 'Tautan karyawan hanya bisa dibuat melalui proses konversi pelamar'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists job_application_employee_link_guard on public.job_applications;
create trigger job_application_employee_link_guard
  before update on public.job_applications
  for each row execute function public.guard_job_application_employee_link();

revoke execute on function public.guard_job_application_employee_link()
  from public, anon, authenticated;

-- Satu transaksi: buat karyawan lalu tautkan ke lamaran.
create or replace function public.convert_job_application_to_employee(
  p_application_id uuid,
  p_employee jsonb
) returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  application public.job_applications;
  v_employee_id text;
  v_manager_id text;
begin
  if not public.current_has_role(array['admin', 'hr_manager']) then
    raise exception 'Akses ditolak: hanya admin atau HR Manager yang dapat mengonversi pelamar'
      using errcode = '42501';
  end if;

  select * into application
  from public.job_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Lamaran tidak ditemukan' using errcode = 'P0002';
  end if;

  if application.employee_id is not null then
    raise exception 'Pelamar ini sudah dikonversi menjadi karyawan'
      using errcode = 'P0001';
  end if;

  if application.stage <> 'Diterima' then
    raise exception 'Pelamar harus berstatus Diterima sebelum dikonversi'
      using errcode = 'P0001';
  end if;

  v_manager_id := nullif(btrim(coalesce(p_employee->>'manager_id', '')), '');

  insert into public.employees (
    full_name, position, department, location, manager_id, joined_at,
    employment_type, status, gender, birth_place, birth_date, address,
    nik, personal_email, work_email, phone,
    emergency_name, emergency_relation, emergency_phone,
    probation_start, probation_end
  ) values (
    btrim(p_employee->>'full_name'),
    btrim(p_employee->>'position'),
    btrim(p_employee->>'department'),
    btrim(p_employee->>'location'),
    v_manager_id,
    (p_employee->>'joined_at')::date,
    p_employee->>'employment_type',
    coalesce(nullif(btrim(p_employee->>'status'), ''), 'Aktif'),
    p_employee->>'gender',
    btrim(p_employee->>'birth_place'),
    (p_employee->>'birth_date')::date,
    btrim(p_employee->>'address'),
    btrim(p_employee->>'nik'),
    lower(btrim(p_employee->>'personal_email')),
    lower(btrim(p_employee->>'work_email')),
    btrim(p_employee->>'phone'),
    btrim(p_employee->>'emergency_name'),
    btrim(p_employee->>'emergency_relation'),
    btrim(p_employee->>'emergency_phone'),
    nullif(btrim(coalesce(p_employee->>'probation_start', '')), '')::date,
    nullif(btrim(coalesce(p_employee->>'probation_end', '')), '')::date
  ) returning id into v_employee_id;

  perform set_config('samaqu.employee_conversion', 'on', true);

  update public.job_applications
  set employee_id = v_employee_id
  where id = application.id;

  return v_employee_id;
end;
$function$;

revoke execute on function public.convert_job_application_to_employee(uuid, jsonb)
  from public, anon;
grant execute on function public.convert_job_application_to_employee(uuid, jsonb)
  to authenticated;
