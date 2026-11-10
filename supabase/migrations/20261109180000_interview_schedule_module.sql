-- Jadwal wawancara per pelamar.
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  round_number integer not null,
  scheduled_at timestamp with time zone not null,
  duration_minutes integer not null default 60,
  mode text not null,
  location_or_link text not null,
  interviewer_name text not null,
  status text not null default 'Dijadwalkan',
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint interviews_duration_check check (duration_minutes between 15 and 480),
  constraint interviews_mode_check check (mode in ('Online', 'Tatap muka')),
  constraint interviews_status_check check (status in ('Dijadwalkan', 'Selesai', 'Dibatalkan', 'Tidak hadir')),
  constraint interviews_interviewer_check check (length(btrim(interviewer_name)) between 1 and 150),
  constraint interviews_location_check check (length(btrim(location_or_link)) between 1 and 500),
  constraint interviews_notes_check check (length(notes) <= 2000),
  constraint interviews_round_check check (round_number >= 1),
  constraint interviews_application_round_key unique (application_id, round_number)
);

create index if not exists interviews_scheduled_idx on public.interviews (scheduled_at);
create index if not exists interviews_status_idx on public.interviews (status);

create table if not exists public.interview_evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  score_communication integer not null,
  score_attitude integer not null,
  score_skill integer not null,
  score_team_fit integer not null,
  recommendation text not null,
  comments text not null default '',
  evaluated_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint interview_evaluations_communication_check check (score_communication between 1 and 5),
  constraint interview_evaluations_attitude_check check (score_attitude between 1 and 5),
  constraint interview_evaluations_skill_check check (score_skill between 1 and 5),
  constraint interview_evaluations_team_fit_check check (score_team_fit between 1 and 5),
  constraint interview_evaluations_recommendation_check check (recommendation in ('Lanjut', 'Pertimbangkan', 'Tolak')),
  constraint interview_evaluations_comments_check check (length(comments) <= 2000)
);

-- Nomor ronde otomatis berikutnya per pelamar.
create or replace function public.assign_interview_round()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if new.round_number is null or new.round_number < 1 then
    perform pg_advisory_xact_lock(hashtextextended(new.application_id::text, 0));
    select coalesce(max(round_number), 0) + 1
      into new.round_number
      from public.interviews
      where application_id = new.application_id;
  end if;
  return new;
end;
$function$;

revoke execute on function public.assign_interview_round() from public, anon, authenticated;

drop trigger if exists interviews_round_assign on public.interviews;
create trigger interviews_round_assign
  before insert on public.interviews
  for each row execute function public.assign_interview_round();

-- Evaluasi hanya untuk wawancara Selesai.
create or replace function public.guard_interview_evaluation()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  interview_status text;
begin
  select status into interview_status
    from public.interviews
    where id = new.interview_id
    for share;

  if interview_status is distinct from 'Selesai' then
    raise exception 'Evaluasi hanya boleh diisi untuk wawancara berstatus Selesai'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke execute on function public.guard_interview_evaluation() from public, anon, authenticated;

drop trigger if exists interview_evaluations_status_guard on public.interview_evaluations;
create trigger interview_evaluations_status_guard
  before insert or update on public.interview_evaluations
  for each row execute function public.guard_interview_evaluation();

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();

drop trigger if exists interview_evaluations_set_updated_at on public.interview_evaluations;
create trigger interview_evaluations_set_updated_at
  before update on public.interview_evaluations
  for each row execute function public.set_updated_at();

alter table public.interviews enable row level security;
alter table public.interview_evaluations enable row level security;

drop policy if exists interviews_staff_all on public.interviews;
create policy interviews_staff_all on public.interviews
  for all to authenticated
  using (public.current_has_role(array['hr_manager', 'recruiter']))
  with check (public.current_has_role(array['hr_manager', 'recruiter']));

drop policy if exists interview_evaluations_staff_all on public.interview_evaluations;
create policy interview_evaluations_staff_all on public.interview_evaluations
  for all to authenticated
  using (public.current_has_role(array['hr_manager', 'recruiter']))
  with check (public.current_has_role(array['hr_manager', 'recruiter']));

revoke all on public.interviews from anon;
revoke all on public.interview_evaluations from anon;

-- Satu query ringkas untuk daftar jadwal + nama pelamar + lowongan + nilai.
create or replace view public.interview_schedule_view
with (security_invoker = true)
as
select
  i.id,
  i.application_id,
  i.round_number,
  i.scheduled_at,
  i.duration_minutes,
  i.mode,
  i.location_or_link,
  i.interviewer_name,
  i.status,
  i.notes,
  i.created_at,
  i.updated_at,
  a.full_name as applicant_name,
  a.job_id,
  j.title as job_title,
  e.id as evaluation_id,
  e.score_communication,
  e.score_attitude,
  e.score_skill,
  e.score_team_fit,
  e.recommendation,
  e.comments,
  case
    when e.id is null then null
    else round(
      (e.score_communication + e.score_attitude + e.score_skill + e.score_team_fit)::numeric / 4,
      2
    )
  end as average_score
from public.interviews i
join public.job_applications a on a.id = i.application_id
join public.job_postings j on j.id = a.job_id
left join public.interview_evaluations e on e.interview_id = i.id;

revoke all on public.interview_schedule_view from authenticated, anon, public;
grant select on public.interview_schedule_view to authenticated, service_role;

notify pgrst, 'reload schema';
