-- Laporan rekrutmen: agregat di database (peran dicek di dalam).

create or replace function public.recruitment_report(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_prev_start timestamp with time zone,
  p_job_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  v_end timestamp with time zone := coalesce(p_end, now());
begin
  if not public.current_has_role(array['admin', 'hr_manager', 'recruiter']) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return (
    with cohort as (
      select a.id, a.job_id, a.stage, a.source, a.created_at
      from public.job_applications a
      where (p_start is null or a.created_at >= p_start)
        and a.created_at < v_end
        and (p_job_id is null or a.job_id = p_job_id)
    ),
    prev_cohort as (
      select a.id, a.stage
      from public.job_applications a
      where p_prev_start is not null
        and a.created_at >= p_prev_start
        and a.created_at < p_start
        and (p_job_id is null or a.job_id = p_job_id)
    ),
    summary as (
      select
        count(*)::int as total,
        count(*) filter (where stage not in ('Diterima', 'Ditolak'))::int as in_progress,
        count(*) filter (where stage = 'Diterima')::int as accepted,
        count(*) filter (where stage = 'Ditolak')::int as rejected
      from cohort
    ),
    prev_summary as (
      select
        count(*)::int as total,
        count(*) filter (where stage not in ('Diterima', 'Ditolak'))::int as in_progress,
        count(*) filter (where stage = 'Diterima')::int as accepted,
        count(*) filter (where stage = 'Ditolak')::int as rejected
      from prev_cohort
    ),
    history as (
      select
        h.application_id, h.from_stage, h.to_stage, h.changed_at,
        lag(h.changed_at) over (
          partition by h.application_id order by h.changed_at, h.id
        ) as prev_at
      from public.job_application_stage_history h
      join cohort c on c.id = h.application_id
    ),
    highest as (
      select
        c.id,
        greatest(
          case c.stage
            when 'Lamaran Masuk' then 0 when 'Screening' then 1
            when 'Wawancara' then 2 when 'Tes' then 3
            when 'Offering' then 4 when 'Diterima' then 5
            else -1
          end,
          coalesce(
            max(
              case h.to_stage
                when 'Lamaran Masuk' then 0 when 'Screening' then 1
                when 'Wawancara' then 2 when 'Tes' then 3
                when 'Offering' then 4 when 'Diterima' then 5
                else -1
              end
            ),
            -1
          )
        )::int as reached
      from cohort c
      left join public.job_application_stage_history h
        on h.application_id = c.id
      group by c.id, c.stage
    ),
    funnel as (
      select s.stage, s.idx,
        (select count(*)::int from highest x where x.reached >= s.idx) as count
      from (values
        ('Lamaran Masuk', 0), ('Screening', 1), ('Wawancara', 2),
        ('Tes', 3), ('Offering', 4), ('Diterima', 5)
      ) s(stage, idx)
    ),
    stage_durations as (
      select h.from_stage as stage,
        extract(epoch from (h.changed_at - h.prev_at)) / 86400.0 as days
      from history h
      where h.from_stage is not null and h.prev_at is not null
    ),
    stage_speed as (
      select s.stage, s.idx,
        (
          select round(avg(d.days)::numeric, 2)
          from stage_durations d
          where d.stage = s.stage
        ) as avg_days,
        (
          select count(*)::int
          from stage_durations d
          where d.stage = s.stage
        ) as sample
      from (values
        ('Lamaran Masuk', 0), ('Screening', 1), ('Wawancara', 2),
        ('Tes', 3), ('Offering', 4)
      ) s(stage, idx)
    ),
    accepted as (
      select h.application_id, min(h.changed_at) as accepted_at
      from public.job_application_stage_history h
      join cohort c on c.id = h.application_id
      where h.to_stage = 'Diterima'
      group by h.application_id
    ),
    accept_speed as (
      select
        round(
          avg(extract(epoch from (a.accepted_at - c.created_at)) / 86400.0)::numeric,
          2
        ) as avg_days,
        count(*)::int as sample
      from accepted a
      join cohort c on c.id = a.application_id
    ),
    per_job as (
      select
        j.id as job_id, j.title,
        count(c.id)::int as total,
        count(c.id) filter (where c.stage not in ('Diterima', 'Ditolak'))::int as in_progress,
        count(c.id) filter (where c.stage = 'Diterima')::int as accepted,
        count(c.id) filter (where c.stage = 'Ditolak')::int as rejected
      from public.job_postings j
      join cohort c on c.job_id = j.id
      group by j.id, j.title
    ),
    bounds as (
      select
        coalesce(p_start, (select min(created_at) from cohort)) as from_at,
        v_end as to_at
    ),
    weeks as (
      select generate_series(
        date_trunc('week', (b.from_at at time zone 'Asia/Jakarta')::date),
        date_trunc('week', (b.to_at at time zone 'Asia/Jakarta')::date),
        interval '1 week'
      )::date as week_start
      from bounds b
      where b.from_at is not null
    ),
    trend as (
      select w.week_start,
        (
          select count(*)::int
          from cohort c
          where date_trunc(
            'week',
            (c.created_at at time zone 'Asia/Jakarta')::date
          )::date = w.week_start
        ) as count
      from weeks w
    ),
    sources as (
      select s.label as source, s.idx,
        (select count(*)::int from cohort c where c.source = s.label) as count
      from (values
        ('Instagram', 1), ('WhatsApp', 2), ('Teman atau keluarga', 3),
        ('Situs lowongan', 4), ('Lainnya', 5), ('', 6)
      ) s(label, idx)
    ),
    interviews as (
      select
        i.status, e.recommendation,
        (e.score_communication + e.score_attitude + e.score_skill + e.score_team_fit) / 4.0 as score
      from public.interviews i
      join cohort c on c.id = i.application_id
      left join public.interview_evaluations e on e.interview_id = i.id
    ),
    interview_summary as (
      select
        count(*)::int as total,
        count(*) filter (where status = 'Selesai')::int as selesai,
        count(*) filter (where status = 'Tidak hadir')::int as tidak_hadir,
        count(*) filter (where status = 'Dibatalkan')::int as dibatalkan,
        round(avg(score)::numeric, 2) as avg_score,
        count(*) filter (where recommendation = 'Lanjut')::int as rec_lanjut,
        count(*) filter (where recommendation = 'Pertimbangkan')::int as rec_pertimbangkan,
        count(*) filter (where recommendation = 'Tolak')::int as rec_tolak
      from interviews
    )
    select jsonb_build_object(
      'summary', (
        select jsonb_build_object(
          'total', s.total,
          'inProgress', s.in_progress,
          'accepted', s.accepted,
          'rejected', s.rejected,
          'previous', case
            when p_prev_start is null then null
            else jsonb_build_object(
              'total', p.total,
              'inProgress', p.in_progress,
              'accepted', p.accepted,
              'rejected', p.rejected
            )
          end
        )
        from summary s cross join prev_summary p
      ),
      'funnel', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('stage', stage, 'count', count)
            order by idx
          ),
          '[]'::jsonb
        )
        from funnel
      ),
      'speed', jsonb_build_object(
        'toAccepted', (
          select jsonb_build_object('avgDays', avg_days, 'sample', sample)
          from accept_speed
        ),
        'stages', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'stage', stage, 'avgDays', avg_days, 'sample', sample
              )
              order by idx
            ),
            '[]'::jsonb
          )
          from stage_speed
        )
      ),
      'perJob', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'jobId', job_id,
              'title', title,
              'total', total,
              'inProgress', in_progress,
              'accepted', accepted,
              'rejected', rejected
            )
            order by total desc, title
          ),
          '[]'::jsonb
        )
        from per_job
      ),
      'trend', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('weekStart', week_start, 'count', count)
            order by week_start
          ),
          '[]'::jsonb
        )
        from trend
      ),
      'sources', (
        select jsonb_agg(
          jsonb_build_object('source', source, 'count', count)
          order by idx
        )
        from sources
      ),
      'interviews', (
        select jsonb_build_object(
          'total', total,
          'selesai', selesai,
          'tidakHadir', tidak_hadir,
          'dibatalkan', dibatalkan,
          'avgScore', avg_score,
          'recommendations', jsonb_build_object(
            'lanjut', rec_lanjut,
            'pertimbangkan', rec_pertimbangkan,
            'tolak', rec_tolak
          )
        )
        from interview_summary
      ),
      'jobs', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('id', id, 'title', title)
            order by title
          ),
          '[]'::jsonb
        )
        from public.job_postings
      )
    )
  );
end;
$function$;

revoke execute on function public.recruitment_report(
  timestamp with time zone, timestamp with time zone,
  timestamp with time zone, uuid
) from public, anon;
grant execute on function public.recruitment_report(
  timestamp with time zone, timestamp with time zone,
  timestamp with time zone, uuid
) to authenticated;

-- Baris pelamar untuk ekspor CSV (tanpa data pribadi).
create or replace function public.recruitment_report_applications(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_job_id uuid default null
) returns table (
  application_number text,
  job_title text,
  stage text,
  source text,
  applied_at timestamp with time zone,
  final_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  v_end timestamp with time zone := coalesce(p_end, now());
begin
  if not public.current_has_role(array['admin', 'hr_manager', 'recruiter']) then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
    select
      a.application_number,
      j.title,
      a.stage,
      a.source,
      a.created_at,
      case
        when a.stage = 'Ditolak' then a.rejected_at
        else (
          select max(h.changed_at)
          from public.job_application_stage_history h
          where h.application_id = a.id and h.to_stage = 'Diterima'
        )
      end
    from public.job_applications a
    join public.job_postings j on j.id = a.job_id
    where (p_start is null or a.created_at >= p_start)
      and a.created_at < v_end
      and (p_job_id is null or a.job_id = p_job_id)
    order by a.created_at desc;
end;
$function$;

revoke execute on function public.recruitment_report_applications(
  timestamp with time zone, timestamp with time zone, uuid
) from public, anon;
grant execute on function public.recruitment_report_applications(
  timestamp with time zone, timestamp with time zone, uuid
) to authenticated;

notify pgrst, 'reload schema';
