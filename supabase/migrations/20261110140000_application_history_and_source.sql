-- Fondasi Laporan: riwayat tahap lamaran + sumber pelamar.

-- ---------------------------------------------------------------------------
-- A. Riwayat perubahan tahap pelamar (trigger-only)
-- ---------------------------------------------------------------------------
create table if not exists public.job_application_stage_history (
  id bigserial primary key,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid,
  changed_at timestamp with time zone not null default now(),
  constraint job_application_stage_history_from_check check (
    from_stage is null
    or from_stage in ('Lamaran Masuk','Screening','Wawancara','Tes','Offering','Diterima','Ditolak')
  ),
  constraint job_application_stage_history_to_check check (
    to_stage in ('Lamaran Masuk','Screening','Wawancara','Tes','Offering','Diterima','Ditolak')
  )
);

comment on column public.job_application_stage_history.changed_by is
  'auth.uid() pelaku; tanpa foreign key agar tetap ada setelah akun dihapus.';

create index if not exists job_application_stage_history_list_idx
  on public.job_application_stage_history (application_id, changed_at desc);

-- Catatan awal saat lamaran masuk dan setiap perubahan tahap.
create or replace function public.log_job_application_stage()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.job_application_stage_history
      (application_id, from_stage, to_stage, changed_by, changed_at)
    values (new.id, null, new.stage, auth.uid(), new.created_at);
    return new;
  end if;

  if new.stage is distinct from old.stage then
    insert into public.job_application_stage_history
      (application_id, from_stage, to_stage, changed_by, changed_at)
    values (new.id, old.stage, new.stage, auth.uid(), now());
  end if;

  return new;
end;
$function$;

revoke execute on function public.log_job_application_stage()
  from public, anon, authenticated;

drop trigger if exists job_applications_stage_history on public.job_applications;
create trigger job_applications_stage_history
  after insert or update of stage on public.job_applications
  for each row execute function public.log_job_application_stage();

alter table public.job_application_stage_history enable row level security;

drop policy if exists job_application_stage_history_staff_read
  on public.job_application_stage_history;
create policy job_application_stage_history_staff_read
  on public.job_application_stage_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager', 'recruiter']));

revoke all on public.job_application_stage_history from anon;
revoke insert, update, delete on public.job_application_stage_history
  from authenticated;
grant select on public.job_application_stage_history
  to authenticated, service_role;

-- Backfill: satu catatan awal Lamaran Masuk untuk lamaran lama.
insert into public.job_application_stage_history
  (application_id, from_stage, to_stage, changed_by, changed_at)
select a.id, null, 'Lamaran Masuk', null, a.created_at
from public.job_applications a
where not exists (
  select 1
  from public.job_application_stage_history h
  where h.application_id = a.id
);

-- Nama pelaku riwayat; recruiter ikut karena boleh membaca timeline.
create or replace function public.application_history_actors(p_ids uuid[])
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if not public.current_has_role(array['admin', 'hr_manager', 'recruiter']) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
    select p.id, p.full_name
    from public.user_profiles p
    where p.id = any(p_ids);
end;
$function$;

revoke execute on function public.application_history_actors(uuid[])
  from public, anon;
grant execute on function public.application_history_actors(uuid[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- B. Sumber pelamar: opsi baru, opsional, validasi di database
-- ---------------------------------------------------------------------------
alter table public.job_applications
  drop constraint if exists job_applications_source_check;

update public.job_applications
set source = 'Teman atau keluarga'
where source = 'Teman';

alter table public.job_applications
  add constraint job_applications_source_check check (
    source in (
      '',
      'Instagram',
      'WhatsApp',
      'Teman atau keluarga',
      'Situs lowongan',
      'Lainnya'
    )
  );

-- Validasi sumber di fungsi submit publik (nilai tetap dijaga constraint).
create or replace function public.submit_job_application(
  p_job_id uuid,
  p_data jsonb,
  p_cv_path text
) returns text
language plpgsql
security invoker
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  job public.job_postings;
  application_no text;
begin
  select * into job from public.job_postings where id = p_job_id for share;
  if not found or job.status <> 'Aktif' or (
    job.closes_at is not null
    and job.closes_at < (now() at time zone 'Asia/Jakarta')::date
  ) then
    raise exception 'Lowongan ini sudah ditutup atau tidak tersedia'
      using errcode = 'P0001';
  end if;

  if (p_data->>'consent')::boolean is distinct from true then
    raise exception 'Persetujuan wajib diisi' using errcode = '23514';
  end if;

  if (p_data->>'birth_date')::date >= (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal lahir tidak valid' using errcode = '23514';
  end if;

  if p_cv_path !~ ('^' || p_job_id::text || '/[a-f0-9-]{36}\.pdf$') then
    raise exception 'CV tidak valid' using errcode = '23514';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'cvs' and name = p_cv_path
      and created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Upload CV tidak tersedia atau kedaluwarsa'
      using errcode = '23514';
  end if;

  if coalesce(p_data->>'source', '') not in (
    '',
    'Instagram',
    'WhatsApp',
    'Teman atau keluarga',
    'Situs lowongan',
    'Lainnya'
  ) then
    raise exception 'Sumber info tidak valid' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_job_id::text || ':' || (p_data->>'whatsapp'), 0)
  );

  if exists (
    select 1 from public.job_applications
    where job_id = p_job_id
      and whatsapp = p_data->>'whatsapp'
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'Nomor WhatsApp ini sudah melamar lowongan yang sama dalam 24 jam terakhir'
      using errcode = '23505';
  end if;

  insert into public.job_applications(
    job_id, full_name, whatsapp, email, birth_date, city, education,
    has_admin_experience, last_position, last_company, experience_length,
    skills, expected_salary, start_availability, source, cv_path,
    portfolio_url, motivation, consent_at
  )
  values (
    p_job_id,
    p_data->>'full_name',
    p_data->>'whatsapp',
    p_data->>'email',
    (p_data->>'birth_date')::date,
    p_data->>'city',
    p_data->>'education',
    (p_data->>'has_admin_experience')::boolean,
    coalesce(p_data->>'last_position', ''),
    coalesce(p_data->>'last_company', ''),
    coalesce(p_data->>'experience_length', ''),
    array(select jsonb_array_elements_text(p_data->'skills')),
    (p_data->>'expected_salary')::numeric,
    p_data->>'start_availability',
    coalesce(p_data->>'source', ''),
    p_cv_path,
    coalesce(p_data->>'portfolio_url', ''),
    coalesce(p_data->>'motivation', ''),
    now()
  )
  returning application_number into application_no;

  return application_no;
end;
$function$;

revoke all on function public.submit_job_application(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_job_application(uuid, jsonb, text)
  to service_role;

notify pgrst, 'reload schema';
