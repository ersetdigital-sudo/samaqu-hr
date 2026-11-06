begin;

alter table public.job_applications
  add column if not exists rejected_at timestamptz,
  add column if not exists cv_deleted_at timestamptz;

-- Data lama tidak punya waktu penolakan; updated_at adalah perkiraan terbaik.
update public.job_applications
set rejected_at = updated_at
where stage = 'Ditolak' and rejected_at is null;

create index if not exists job_applications_retention_idx
  on public.job_applications(stage, rejected_at)
  where cv_deleted_at is null;

create or replace function public.guard_job_application() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare stages text[] := array['Lamaran Masuk','Screening','Wawancara','Tes','Offering','Diterima'];
begin
  if new.stage is distinct from old.stage and not coalesce((
    (new.stage='Ditolak' and old.stage<>'Diterima') or
    (old.stage='Ditolak' and new.stage='Lamaran Masuk') or
    new.stage=stages[array_position(stages,old.stage)+1]
  ),false) then raise exception 'Perpindahan tahap tidak valid' using errcode='23514'; end if;

  if new.stage is distinct from old.stage then
    if new.stage = 'Ditolak' then
      new.rejected_at := now();
    else
      new.rejected_at := null;
    end if;
  else
    new.rejected_at := old.rejected_at;
  end if;

  new.reviewed_at := case when old.reviewed_at is not null then old.reviewed_at when new.reviewed_at is not null then now() else null end;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_job_application() from public,anon,authenticated;

create or replace function public.recruitment_cvs_due(
  p_rejected_days integer,
  p_closed_days integer,
  p_limit integer default 100
) returns table(application_id uuid, cv_path text)
language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
  select a.id, a.cv_path
  from public.job_applications a
  join public.job_postings j on j.id = a.job_id
  where a.cv_deleted_at is null
    and p_rejected_days > 0
    and p_closed_days > 0
    and (
      (
        a.stage = 'Ditolak'
        and a.rejected_at is not null
        and a.rejected_at <= now() - make_interval(days => p_rejected_days)
      )
      or (
        a.stage in ('Lamaran Masuk','Screening','Wawancara','Tes','Offering')
        and (
          (
            j.status = 'Ditutup'
            and j.closed_at is not null
            and j.closed_at <= now() - make_interval(days => p_closed_days)
          )
          or (
            j.status in ('Aktif','Ditutup')
            and j.closes_at is not null
            and j.closes_at < (now() at time zone 'Asia/Jakarta')::date
            and j.closes_at + p_closed_days <= (now() at time zone 'Asia/Jakarta')::date
          )
        )
      )
    )
  order by a.id
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;
revoke all on function public.recruitment_cvs_due(integer, integer, integer) from public,anon,authenticated;
grant execute on function public.recruitment_cvs_due(integer, integer, integer) to service_role;

commit;
notify pgrst, 'reload schema';
