-- Onboarding karyawan baru: checklist orientasi + pembuatan otomatis saat konversi.

-- Template standar, satu sumber data di database agar mudah diubah.
create or replace function public.onboarding_template_items()
returns table (label text, sort_order integer)
language sql
immutable
as $function$
  values
    ('Kelengkapan berkas', 1),
    ('Pembuatan akun dan email kerja', 2),
    ('Penyerahan alat kerja', 3),
    ('Orientasi perusahaan dan SOP', 4),
    ('Perkenalan dengan tim', 5),
    ('Evaluasi minggu pertama', 6);
$function$;

revoke execute on function public.onboarding_template_items()
  from public, anon, authenticated;

create table if not exists public.employee_onboardings (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique references public.employees(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists employee_onboardings_created_idx
  on public.employee_onboardings (created_at desc);

create table if not exists public.employee_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.employee_onboardings(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  completed_on date,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employee_onboarding_items_label_check
    check (length(btrim(label)) between 1 and 200),
  constraint employee_onboarding_items_notes_check
    check (length(notes) <= 500),
  constraint employee_onboarding_items_completion_check
    check (done = (completed_on is not null))
);

create index if not exists employee_onboarding_items_list_idx
  on public.employee_onboarding_items (onboarding_id, sort_order);

-- Tanggal selesai otomatis saat dicentang (hari ini WIB) dan kosong saat batal.
create or replace function public.sync_onboarding_item_completion()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if new.done then
    if new.completed_on is null then
      new.completed_on := (now() at time zone 'Asia/Jakarta')::date;
    end if;
  else
    new.completed_on := null;
  end if;
  return new;
end;
$function$;

revoke execute on function public.sync_onboarding_item_completion()
  from public, anon, authenticated;

drop trigger if exists employee_onboarding_items_completion_sync
  on public.employee_onboarding_items;
create trigger employee_onboarding_items_completion_sync
  before insert or update on public.employee_onboarding_items
  for each row execute function public.sync_onboarding_item_completion();

drop trigger if exists employee_onboardings_set_updated_at
  on public.employee_onboardings;
create trigger employee_onboardings_set_updated_at
  before update on public.employee_onboardings
  for each row execute function public.set_updated_at();

drop trigger if exists employee_onboarding_items_set_updated_at
  on public.employee_onboarding_items;
create trigger employee_onboarding_items_set_updated_at
  before update on public.employee_onboarding_items
  for each row execute function public.set_updated_at();

alter table public.employee_onboardings enable row level security;
alter table public.employee_onboarding_items enable row level security;

drop policy if exists employee_onboardings_hr_all on public.employee_onboardings;
create policy employee_onboardings_hr_all on public.employee_onboardings
  for all to authenticated
  using (public.current_has_role(array['hr_manager']))
  with check (public.current_has_role(array['hr_manager']));

drop policy if exists employee_onboarding_items_hr_all on public.employee_onboarding_items;
create policy employee_onboarding_items_hr_all on public.employee_onboarding_items
  for all to authenticated
  using (public.current_has_role(array['hr_manager']))
  with check (public.current_has_role(array['hr_manager']));

revoke all on public.employee_onboardings from anon;
revoke all on public.employee_onboarding_items from anon;

-- Mulai onboarding manual untuk karyawan yang belum punya.
create or replace function public.start_employee_onboarding(p_employee_id text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  v_status text;
  v_id uuid;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager yang dapat memulai onboarding'
      using errcode = '42501';
  end if;

  select status into v_status
  from public.employees
  where id = p_employee_id;

  if not found then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_status = 'Nonaktif' then
    raise exception 'Karyawan nonaktif tidak bisa memulai onboarding'
      using errcode = '23514';
  end if;

  insert into public.employee_onboardings (employee_id, created_by)
  values (p_employee_id, auth.uid())
  returning id into v_id;

  insert into public.employee_onboarding_items
    (onboarding_id, label, sort_order)
  select v_id, t.label, t.sort_order
  from public.onboarding_template_items() t;

  return v_id;
end;
$function$;

revoke execute on function public.start_employee_onboarding(text)
  from public, anon;
grant execute on function public.start_employee_onboarding(text)
  to authenticated;

-- Konversi pelamar: karyawan + onboarding + item template dalam satu transaksi.
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
  v_onboarding_id uuid;
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

  insert into public.employee_onboardings (employee_id)
  values (v_employee_id)
  returning id into v_onboarding_id;

  insert into public.employee_onboarding_items
    (onboarding_id, label, sort_order)
  select v_onboarding_id, t.label, t.sort_order
  from public.onboarding_template_items() t;

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

notify pgrst, 'reload schema';
