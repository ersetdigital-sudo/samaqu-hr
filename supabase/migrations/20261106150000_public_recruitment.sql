begin;

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  department text not null check (length(btrim(department)) between 1 and 100),
  location text not null check (length(btrim(location)) between 1 and 200),
  employment_type text not null check (employment_type in ('Full-time','Kontrak','Magang','Harian')),
  headcount integer not null check (headcount between 1 and 10000),
  summary text not null check (length(btrim(summary)) between 1 and 200),
  duties text[] not null check (cardinality(duties) between 1 and 8 and array_position(duties,null) is null),
  qualifications text[] not null check (cardinality(qualifications) between 1 and 8 and array_position(qualifications,null) is null),
  closes_at date,
  status text not null default 'Draf' check (status in ('Draf','Aktif','Ditutup')),
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_postings_status_closes_idx on public.job_postings(status,closes_at);
create index job_postings_creator_idx on public.job_postings(created_by);
alter table public.job_postings enable row level security;
revoke all on public.job_postings from anon, authenticated;
grant select, insert, update on public.job_postings to authenticated;
grant all on public.job_postings to service_role;
create policy job_postings_staff on public.job_postings for all to authenticated
  using ((select public.current_has_role(array['hr_manager','recruiter'])))
  with check ((select public.current_has_role(array['hr_manager','recruiter'])));

create function public.guard_job_posting() returns trigger
language plpgsql security invoker set search_path = pg_catalog, pg_temp as $$
begin
  if exists (select 1 from unnest(new.duties || new.qualifications) p where length(btrim(p)) not between 1 and 500) then
    raise exception 'Poin wajib diisi, maksimal 500 karakter' using errcode='23514';
  end if;
  if tg_op = 'UPDATE' then
    if old.published_at is not null and new.slug is distinct from old.slug then
      raise exception 'Slug terkunci setelah dipublikasikan' using errcode='23514';
    end if;
    if old.published_at is not null and new.status = 'Draf' then
      raise exception 'Lowongan terpublikasi tidak bisa dikembalikan menjadi draf' using errcode='23514';
    end if;
    if (old.status = 'Ditutup' or (old.status = 'Aktif' and old.closes_at < (now() at time zone 'Asia/Jakarta')::date)) and new.status <> 'Ditutup' then
      raise exception 'Duplikat lowongan untuk membuka kembali' using errcode='23514';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.published_at := old.published_at;
    new.closed_at := old.closed_at;
  else
    new.published_at := null;
    new.closed_at := null;
  end if;
  if new.status = 'Aktif' and new.published_at is null then new.published_at := now(); end if;
  if new.status = 'Ditutup' and new.closed_at is null then new.closed_at := now(); end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_job_posting() from public, anon, authenticated;
create trigger job_posting_guard before insert or update on public.job_postings
  for each row execute function public.guard_job_posting();

create sequence public.job_application_number_seq;
create function public.next_job_application_number() returns text
language sql volatile security invoker set search_path=pg_catalog,pg_temp as $$
  select 'SQ-APL-' || case when n < 10000 then lpad(n::text,4,'0') else n::text end
  from nextval('public.job_application_number_seq'::regclass) n;
$$;
revoke all on sequence public.job_application_number_seq from anon, authenticated;
grant usage,select on sequence public.job_application_number_seq to service_role;
revoke all on function public.next_job_application_number() from public, anon, authenticated;
grant execute on function public.next_job_application_number() to service_role;

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique default public.next_job_application_number(),
  job_id uuid not null references public.job_postings(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 150),
  whatsapp text not null check (whatsapp ~ '^628[0-9]{7,11}$'),
  email text not null check (length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  birth_date date not null check (birth_date >= date '1900-01-01'),
  city text not null check (length(btrim(city)) between 1 and 100),
  education text not null check (education in ('SMP','SMA/SMK','D3','S1','Lainnya')),
  has_admin_experience boolean not null,
  last_position text not null default '' check (length(last_position)<=150),
  last_company text not null default '' check (length(last_company)<=150),
  experience_length text not null default '' check (experience_length in ('','<1 thn','1–2 thn','>2 thn')),
  skills text[] not null default '{}' check (cardinality(skills)<=4 and array_position(skills,null) is null and skills <@ array['Excel / Google Sheets','Shopee / TikTok Seller','WhatsApp Business','Canva']),
  expected_salary numeric(12,0) not null check (expected_salary between 0 and 1000000000),
  start_availability text not null check (start_availability in ('Segera','2 minggu','1 bulan')),
  source text not null default '' check (source in ('','Instagram','WhatsApp','Teman','Lainnya')),
  cv_path text not null unique,
  portfolio_url text not null default '' check (length(portfolio_url)<=2000 and (portfolio_url='' or portfolio_url ~ '^https?://')),
  motivation text not null default '' check (length(motivation)<=2000),
  consent_at timestamptz not null,
  stage text not null default 'Lamaran Masuk' check (stage in ('Lamaran Masuk','Screening','Wawancara','Tes','Offering','Diterima','Ditolak')),
  internal_note text not null default '' check (length(internal_note)<=10000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not has_admin_experience or (length(btrim(last_position))>0 and length(btrim(last_company))>0 and experience_length<>''))
);
create index job_applications_job_created_idx on public.job_applications(job_id,created_at desc);
create index job_applications_duplicate_idx on public.job_applications(job_id,whatsapp,created_at desc);
create index job_applications_job_stage_idx on public.job_applications(job_id,stage);
create index job_applications_unreviewed_idx on public.job_applications(job_id) where reviewed_at is null;
alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon, authenticated;
grant select on public.job_applications to authenticated;
grant update(stage,internal_note,reviewed_at) on public.job_applications to authenticated;
grant all on public.job_applications to service_role;
create policy job_applications_staff_read on public.job_applications for select to authenticated
  using ((select public.current_has_role(array['hr_manager','recruiter'])));
create policy job_applications_staff_update on public.job_applications for update to authenticated
  using ((select public.current_has_role(array['hr_manager','recruiter'])))
  with check ((select public.current_has_role(array['hr_manager','recruiter'])));
create function public.guard_job_application() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare stages text[] := array['Lamaran Masuk','Screening','Wawancara','Tes','Offering','Diterima'];
begin
  if new.stage is distinct from old.stage and not coalesce((
    (new.stage='Ditolak' and old.stage<>'Diterima') or
    (old.stage='Ditolak' and new.stage='Lamaran Masuk') or
    new.stage=stages[array_position(stages,old.stage)+1]
  ),false) then raise exception 'Perpindahan tahap tidak valid' using errcode='23514'; end if;
  new.reviewed_at := case when old.reviewed_at is not null then old.reviewed_at when new.reviewed_at is not null then now() else null end;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_job_application() from public,anon,authenticated;
create trigger job_application_guard before update on public.job_applications for each row execute function public.guard_job_application();

create table public.recruitment_submit_limits (
  ip_hash text primary key check (ip_hash ~ '^[a-f0-9]{64}$'),
  attempts timestamptz[] not null default '{}',
  updated_at timestamptz not null default now()
);
create index recruitment_submit_limits_updated_idx on public.recruitment_submit_limits(updated_at);
alter table public.recruitment_submit_limits enable row level security;
revoke all on public.recruitment_submit_limits from anon,authenticated;
grant all on public.recruitment_submit_limits to service_role;
create function public.consume_recruitment_submit(p_ip_hash text) returns boolean
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare recent timestamptz[];
begin
  delete from public.recruitment_submit_limits where updated_at < now()-interval '1 day';
  insert into public.recruitment_submit_limits(ip_hash) values (p_ip_hash) on conflict do nothing;
  select array(select t from unnest(attempts) t where t > now()-interval '1 hour') into recent
    from public.recruitment_submit_limits where ip_hash=p_ip_hash for update;
  if cardinality(recent)>=5 then return false; end if;
  update public.recruitment_submit_limits set attempts=array_append(recent,now()),updated_at=now() where ip_hash=p_ip_hash;
  return true;
end;
$$;
revoke all on function public.consume_recruitment_submit(text) from public,anon,authenticated;
grant execute on function public.consume_recruitment_submit(text) to service_role;

create function public.submit_job_application(p_job_id uuid,p_data jsonb,p_cv_path text) returns text
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare job public.job_postings; application_no text;
begin
  select * into job from public.job_postings where id=p_job_id for share;
  if not found or job.status<>'Aktif' or (job.closes_at is not null and job.closes_at < (now() at time zone 'Asia/Jakarta')::date) then
    raise exception 'Lowongan ini sudah ditutup atau tidak tersedia' using errcode='P0001';
  end if;
  if (p_data->>'consent')::boolean is distinct from true then raise exception 'Persetujuan wajib diisi' using errcode='23514'; end if;
  if (p_data->>'birth_date')::date >= (now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal lahir tidak valid' using errcode='23514'; end if;
  if p_cv_path !~ ('^' || p_job_id::text || '/[a-f0-9-]{36}\.pdf$') then raise exception 'CV tidak valid' using errcode='23514'; end if;
  if not exists(select 1 from storage.objects where bucket_id='cvs' and name=p_cv_path and created_at>now()-interval '15 minutes') then
    raise exception 'Upload CV tidak tersedia atau kedaluwarsa' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_job_id::text || ':' || (p_data->>'whatsapp'),0));
  if exists(select 1 from public.job_applications where job_id=p_job_id and whatsapp=p_data->>'whatsapp' and created_at>now()-interval '24 hours') then
    raise exception 'Nomor WhatsApp ini sudah melamar lowongan yang sama dalam 24 jam terakhir' using errcode='23505';
  end if;
  insert into public.job_applications(job_id,full_name,whatsapp,email,birth_date,city,education,has_admin_experience,last_position,last_company,experience_length,skills,expected_salary,start_availability,source,cv_path,portfolio_url,motivation,consent_at)
  values(p_job_id,p_data->>'full_name',p_data->>'whatsapp',p_data->>'email',(p_data->>'birth_date')::date,p_data->>'city',p_data->>'education',(p_data->>'has_admin_experience')::boolean,coalesce(p_data->>'last_position',''),coalesce(p_data->>'last_company',''),coalesce(p_data->>'experience_length',''),array(select jsonb_array_elements_text(p_data->'skills')),(p_data->>'expected_salary')::numeric,p_data->>'start_availability',coalesce(p_data->>'source',''),p_cv_path,coalesce(p_data->>'portfolio_url',''),coalesce(p_data->>'motivation',''),now())
  returning application_number into application_no;
  return application_no;
end;
$$;
revoke all on function public.submit_job_application(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_job_application(uuid,jsonb,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('cvs','cvs',false,2097152,array['application/pdf']);
create policy recruitment_cvs_staff_read on storage.objects for select to authenticated
  using (bucket_id='cvs' and (select public.current_has_role(array['hr_manager','recruiter'])));

create function public.unreferenced_recruitment_cvs() returns table(path text)
language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
  select o.name from storage.objects o where o.bucket_id='cvs' and o.created_at < now()-interval '1 day'
    and not exists(select 1 from public.job_applications a where a.cv_path=o.name)
  order by o.created_at limit 20;
$$;
revoke all on function public.unreferenced_recruitment_cvs() from public,anon,authenticated;
grant execute on function public.unreferenced_recruitment_cvs() to service_role;

commit;
notify pgrst,'reload schema';
