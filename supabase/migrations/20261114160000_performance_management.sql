-- =============================================================================
-- 20261114160000_performance_management.sql
-- Performance Management ringan: periode semester, penilaian atasan, review HR.
--
--  * Semua penulisan lewat fungsi SECURITY DEFINER atomik.
--  * Tabel hanya SELECT untuk authenticated; RLS membatasi baris per peran.
--  * Snapshot aspek, karyawan, dan penilai disimpan agar riwayat tidak berubah.
-- =============================================================================

create table if not exists public.performance_aspects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default ''
    check (length(description) <= 500),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 160),
  start_date date not null,
  end_date date not null,
  due_date date not null,
  status text not null default 'Terbuka'
    check (status in ('Terbuka', 'Ditutup')),
  ineligible_employees jsonb not null default '[]'::jsonb,
  opened_by uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint performance_periods_dates
    check (start_date <= end_date),
  constraint performance_periods_due
    check (due_date >= start_date)
);

create unique index if not exists performance_periods_one_open_idx
  on public.performance_periods (status)
  where status = 'Terbuka';

create index if not exists performance_periods_dates_idx
  on public.performance_periods (start_date desc, end_date desc);

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null
    references public.performance_periods (id) on delete restrict,
  employee_id text not null
    references public.employees (id) on delete restrict,
  employee_name text not null,
  department text not null,
  position text not null,
  reviewer_employee_id text
    references public.employees (id) on delete set null,
  reviewer_name text,
  reviewer_department text,
  reviewer_position text,
  status text not null default 'Draft'
    check (status in (
      'Draft', 'Dikirim', 'Dikembalikan', 'Final', 'Dikecualikan', 'Tidak lengkap'
    )),
  achievement_notes text not null default ''
    check (length(achievement_notes) <= 4000),
  strengths text not null default ''
    check (length(strengths) <= 4000),
  improvement_areas text not null default ''
    check (length(improvement_areas) <= 4000),
  general_notes text not null default ''
    check (length(general_notes) <= 4000),
  final_score numeric(4,2)
    check (final_score is null or (final_score >= 0 and final_score <= 5)),
  final_category text
    check (final_category is null or final_category in (
      'Sangat Baik', 'Baik', 'Cukup', 'Perlu Perbaikan'
    )),
  return_reason text,
  excluded_reason text,
  submitted_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  excluded_by uuid references auth.users (id) on delete set null,
  excluded_at timestamptz,
  last_filled_by uuid references auth.users (id) on delete set null,
  last_filled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, employee_id)
);

create index if not exists performance_reviews_period_idx
  on public.performance_reviews (period_id, status);
create index if not exists performance_reviews_reviewer_idx
  on public.performance_reviews (reviewer_employee_id, status);
create index if not exists performance_reviews_employee_idx
  on public.performance_reviews (employee_id, status);

create table if not exists public.performance_review_scores (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null
    references public.performance_reviews (id) on delete cascade,
  aspect_id uuid
    references public.performance_aspects (id) on delete restrict,
  aspect_name text not null,
  aspect_description text not null default '',
  sort_order integer not null default 0,
  score smallint check (score is null or (score >= 1 and score <= 5)),
  note text not null default '' check (length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, sort_order)
);

create index if not exists performance_review_scores_review_idx
  on public.performance_review_scores (review_id, sort_order);

create table if not exists public.performance_review_history (
  id bigserial primary key,
  review_id uuid not null
    references public.performance_reviews (id) on delete cascade,
  action text not null,
  from_status text,
  to_status text,
  reason text,
  actor_id uuid,
  actor_name text,
  acted_at timestamptz not null default now()
);

create index if not exists performance_review_history_review_idx
  on public.performance_review_history (review_id, acted_at desc);

drop trigger if exists performance_aspects_set_updated_at on public.performance_aspects;
create trigger performance_aspects_set_updated_at
  before update on public.performance_aspects
  for each row execute function public.set_updated_at();

drop trigger if exists performance_periods_set_updated_at on public.performance_periods;
create trigger performance_periods_set_updated_at
  before update on public.performance_periods
  for each row execute function public.set_updated_at();

drop trigger if exists performance_reviews_set_updated_at on public.performance_reviews;
create trigger performance_reviews_set_updated_at
  before update on public.performance_reviews
  for each row execute function public.set_updated_at();

drop trigger if exists performance_review_scores_set_updated_at
  on public.performance_review_scores;
create trigger performance_review_scores_set_updated_at
  before update on public.performance_review_scores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper baca (menghindari rekursi RLS antar tabel)
-- ---------------------------------------------------------------------------
create or replace function public.performance_review_readable(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from public.performance_reviews r
    join public.performance_periods p on p.id = r.period_id
    where r.id = p_review_id
      and (
        public.current_has_role(array['hr_manager'])
        or (
          public.current_app_role() = 'employee'
          and p.status = 'Terbuka'
          and r.reviewer_employee_id = public.current_employee_id()
        )
        or (
          public.current_app_role() = 'employee'
          and p.status = 'Ditutup'
          and r.status = 'Final'
          and r.employee_id = public.current_employee_id()
        )
      )
  );
$$;

create or replace function public.performance_period_readable(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from public.performance_periods p
    where p.id = p_period_id
      and (
        public.current_has_role(array['hr_manager'])
        or (
          public.current_app_role() = 'employee'
          and p.status = 'Terbuka'
          and exists (
            select 1 from public.performance_reviews r
            where r.period_id = p.id
              and r.reviewer_employee_id = public.current_employee_id()
          )
        )
        or (
          public.current_app_role() = 'employee'
          and p.status = 'Ditutup'
          and exists (
            select 1 from public.performance_reviews r
            where r.period_id = p.id
              and r.employee_id = public.current_employee_id()
              and r.status = 'Final'
          )
        )
      )
  );
$$;

create or replace function public.performance_review_history_readable(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from public.performance_reviews r
    join public.performance_periods p on p.id = r.period_id
    where r.id = p_review_id
      and (
        public.current_has_role(array['hr_manager'])
        or (
          public.current_app_role() = 'employee'
          and p.status = 'Terbuka'
          and r.reviewer_employee_id = public.current_employee_id()
        )
      )
  );
$$;

revoke all on function public.performance_review_readable(uuid) from public, anon;
revoke all on function public.performance_period_readable(uuid) from public, anon;
revoke all on function public.performance_review_history_readable(uuid)
  from public, anon;
grant execute on function public.performance_review_readable(uuid) to authenticated;
grant execute on function public.performance_period_readable(uuid) to authenticated;
grant execute on function public.performance_review_history_readable(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: SELECT-only untuk authenticated, baris dibatasi helper di atas.
-- ---------------------------------------------------------------------------
alter table public.performance_aspects enable row level security;
alter table public.performance_periods enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.performance_review_scores enable row level security;
alter table public.performance_review_history enable row level security;

drop policy if exists performance_aspects_staff_read on public.performance_aspects;
create policy performance_aspects_staff_read
  on public.performance_aspects for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists performance_periods_read on public.performance_periods;
create policy performance_periods_read
  on public.performance_periods for select to authenticated
  using (public.performance_period_readable(id));

drop policy if exists performance_reviews_read on public.performance_reviews;
create policy performance_reviews_read
  on public.performance_reviews for select to authenticated
  using (public.performance_review_readable(id));

drop policy if exists performance_review_scores_read
  on public.performance_review_scores;
create policy performance_review_scores_read
  on public.performance_review_scores for select to authenticated
  using (public.performance_review_readable(review_id));

drop policy if exists performance_review_history_read
  on public.performance_review_history;
create policy performance_review_history_read
  on public.performance_review_history for select to authenticated
  using (public.performance_review_history_readable(review_id));

revoke all on public.performance_aspects from anon, authenticated;
revoke all on public.performance_periods from anon, authenticated;
revoke all on public.performance_reviews from anon, authenticated;
revoke all on public.performance_review_scores from anon, authenticated;
revoke all on public.performance_review_history from anon, authenticated;

grant select on public.performance_aspects to authenticated;
grant select on public.performance_periods to authenticated;
grant select on public.performance_reviews to authenticated;
grant select on public.performance_review_scores to authenticated;
grant select on public.performance_review_history to authenticated;

grant select, insert, update, delete on public.performance_aspects to service_role;
grant select, insert, update, delete on public.performance_periods to service_role;
grant select, insert, update, delete on public.performance_reviews to service_role;
grant select, insert, update, delete on public.performance_review_scores to service_role;
grant select, insert, update, delete on public.performance_review_history to service_role;
grant usage, select on sequence public.performance_review_history_id_seq
  to service_role;

-- ---------------------------------------------------------------------------
-- Fungsi aturan
-- ---------------------------------------------------------------------------
create or replace function public.performance_category_for_score(p_score numeric)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select case
    when p_score is null then null
    when p_score >= 4.50 then 'Sangat Baik'
    when p_score >= 3.50 then 'Baik'
    when p_score >= 2.50 then 'Cukup'
    else 'Perlu Perbaikan'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Aspek
-- ---------------------------------------------------------------------------
create or replace function public.save_performance_aspect(
  p_aspect_id uuid,
  p_name text,
  p_description text,
  p_sort_order integer,
  p_is_active boolean
)
returns public.performance_aspects
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_aspect public.performance_aspects;
  v_name text;
  v_description text;
  v_active_count integer;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengatur aspek'
      using errcode = '42501';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    raise exception 'Nama aspek wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_name) > 120 then
    raise exception 'Nama aspek maksimal 120 karakter' using errcode = 'P0001';
  end if;
  v_description := btrim(coalesce(p_description, ''));
  if length(v_description) > 500 then
    raise exception 'Deskripsi aspek maksimal 500 karakter'
      using errcode = 'P0001';
  end if;

  if p_aspect_id is null then
    insert into public.performance_aspects (
      name, description, sort_order, is_active
    ) values (
      v_name, v_description, coalesce(p_sort_order, 0), coalesce(p_is_active, true)
    )
    returning * into v_aspect;
    return v_aspect;
  end if;

  select * into v_aspect
  from public.performance_aspects
  where id = p_aspect_id
  for update;
  if not found then
    raise exception 'Aspek tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_aspect.is_active and not coalesce(p_is_active, true) then
    select count(*) into v_active_count
    from public.performance_aspects
    where is_active and id <> v_aspect.id;
    if v_active_count < 3 then
      raise exception 'Minimal 3 aspek aktif harus tersisa'
        using errcode = 'P0001';
    end if;
  end if;

  update public.performance_aspects
  set name = v_name,
      description = v_description,
      sort_order = coalesce(p_sort_order, v_aspect.sort_order),
      is_active = coalesce(p_is_active, v_aspect.is_active)
  where id = v_aspect.id
  returning * into v_aspect;

  return v_aspect;
end;
$$;

comment on function public.save_performance_aspect(uuid, text, text, integer, boolean)
  is 'Tambah/ubah aspek penilaian. Aspek tidak pernah dihapus, hanya dinonaktifkan.';

-- ---------------------------------------------------------------------------
-- Periode: snapshot aspek + pembuatan lembar
-- ---------------------------------------------------------------------------
create or replace function public.create_performance_period(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_due_date date
)
returns public.performance_periods
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_period public.performance_periods;
  v_name text;
  v_active_aspects integer;
  v_ineligible jsonb;
  v_actor_name text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat membuka periode'
      using errcode = '42501';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    raise exception 'Nama periode wajib diisi' using errcode = 'P0001';
  end if;
  if length(v_name) > 160 then
    raise exception 'Nama periode maksimal 160 karakter' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.performance_periods where lower(name) = lower(v_name)
  ) then
    raise exception 'Nama periode sudah digunakan' using errcode = 'P0001';
  end if;
  if p_start_date is null or p_end_date is null or p_due_date is null then
    raise exception 'Tanggal periode dan batas pengisian wajib diisi'
      using errcode = 'P0001';
  end if;
  if p_start_date > p_end_date then
    raise exception 'Tanggal mulai tidak boleh melewati tanggal akhir'
      using errcode = 'P0001';
  end if;
  if p_due_date < p_start_date then
    raise exception 'Batas pengisian tidak boleh sebelum tanggal mulai'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.performance_periods where status = 'Terbuka'
  ) then
    raise exception 'Masih ada periode Terbuka. Tutup periode tersebut terlebih dahulu.'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.performance_periods
    where daterange(start_date, end_date, '[]')
      && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Rentang tanggal bertabrakan dengan periode lain'
      using errcode = 'P0001';
  end if;

  select count(*) into v_active_aspects
  from public.performance_aspects where is_active;
  if v_active_aspects < 3 then
    raise exception 'Minimal 3 aspek aktif diperlukan untuk membuka periode'
      using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', e.id,
    'employee_name', e.full_name,
    'reason', case
      when e.status not in ('Aktif', 'Probation') then 'Status ' || e.status
      else 'Masa kerja belum 3 bulan'
    end
  ) order by e.full_name), '[]'::jsonb)
  into v_ineligible
  from public.employees e
  where not (
    e.status in ('Aktif', 'Probation')
    and e.joined_at <= (p_end_date - interval '3 months')::date
  );

  insert into public.performance_periods (
    name, start_date, end_date, due_date, status, ineligible_employees, opened_by
  ) values (
    v_name, p_start_date, p_end_date, p_due_date, 'Terbuka', v_ineligible, auth.uid()
  )
  returning * into v_period;

  insert into public.performance_reviews (
    period_id, employee_id, employee_name, department, position,
    reviewer_employee_id, reviewer_name, reviewer_department, reviewer_position
  )
  select
    v_period.id, e.id, e.full_name, e.department, e.position,
    m.id, m.full_name, m.department, m.position
  from public.employees e
  left join public.employees m on m.id = e.manager_id
  where e.status in ('Aktif', 'Probation')
    and e.joined_at <= (p_end_date - interval '3 months')::date;

  insert into public.performance_review_scores (
    review_id, aspect_id, aspect_name, aspect_description, sort_order
  )
  select r.id, a.id, a.name, a.description, a.sort_order
  from public.performance_reviews r
  cross join public.performance_aspects a
  where r.period_id = v_period.id and a.is_active;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  )
  select r.id, 'Dibuat', null, 'Draft',
         format('Snapshot periode %s', v_period.name),
         auth.uid(), coalesce(v_actor_name, 'Sistem')
  from public.performance_reviews r
  where r.period_id = v_period.id;

  return v_period;
end;
$$;

-- ---------------------------------------------------------------------------
-- Penilai
-- ---------------------------------------------------------------------------
create or replace function public.set_performance_reviewer(
  p_review_id uuid,
  p_reviewer_employee_id text,
  p_reason text
)
returns public.performance_reviews
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_review public.performance_reviews;
  v_period public.performance_periods;
  v_reviewer public.employees;
  v_reason text;
  v_actor_name text;
  v_old_reviewer text;
  v_from_status text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengganti penilai'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan penggantian penilai wajib diisi'
      using errcode = 'P0001';
  end if;

  select * into v_review
  from public.performance_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Lembar penilaian tidak ditemukan' using errcode = 'P0002';
  end if;

  select * into v_period
  from public.performance_periods where id = v_review.period_id;
  if v_period.status <> 'Terbuka' then
    raise exception 'Penilai hanya dapat diganti saat periode Terbuka'
      using errcode = 'P0001';
  end if;
  if v_review.status in ('Final', 'Dikecualikan', 'Tidak lengkap') then
    raise exception 'Lembar berstatus % tidak dapat diganti penilainya',
      v_review.status using errcode = 'P0001';
  end if;

  select * into v_reviewer
  from public.employees where id = p_reviewer_employee_id;
  if not found then
    raise exception 'Calon penilai tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_reviewer.status not in ('Aktif', 'Probation') then
    raise exception 'Calon penilai harus karyawan aktif atau probation'
      using errcode = 'P0001';
  end if;
  if v_reviewer.id = v_review.employee_id then
    raise exception 'Penilai tidak boleh menilai dirinya sendiri'
      using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  v_old_reviewer := coalesce(v_review.reviewer_name, 'Belum ada');
  v_from_status := v_review.status;

  update public.performance_reviews
  set reviewer_employee_id = v_reviewer.id,
      reviewer_name = v_reviewer.full_name,
      reviewer_department = v_reviewer.department,
      reviewer_position = v_reviewer.position
  where id = v_review.id
  returning * into v_review;

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  ) values (
    v_review.id, 'Penilai Diganti', v_from_status, v_review.status,
    format('Dari %s ke %s: %s', v_old_reviewer, v_reviewer.full_name, v_reason),
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  );

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Isi penilaian (Draft)
-- ---------------------------------------------------------------------------
create or replace function public.save_performance_draft(
  p_review_id uuid,
  p_scores jsonb,
  p_achievement_notes text,
  p_strengths text,
  p_improvement_areas text,
  p_general_notes text
)
returns public.performance_reviews
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_review public.performance_reviews;
  v_period public.performance_periods;
  v_actor_employee text;
  v_is_staff boolean;
  v_item jsonb;
  v_score public.performance_review_scores;
  v_score_id uuid;
  v_score_value integer;
  v_note text;
  v_seen uuid[] := '{}';
  v_actor_name text;
  v_from_status text;
begin
  v_is_staff := public.current_has_role(array['hr_manager']);
  v_actor_employee := public.current_employee_id();

  select * into v_review
  from public.performance_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Lembar penilaian tidak ditemukan' using errcode = 'P0002';
  end if;
  if not v_is_staff and (
    public.current_app_role() is distinct from 'employee'
    or v_actor_employee is null
    or v_actor_employee is distinct from v_review.reviewer_employee_id
  ) then
    raise exception 'Akses ditolak: lembar ini bukan penugasan Anda'
      using errcode = '42501';
  end if;
  if v_actor_employee is not null and v_actor_employee = v_review.employee_id then
    raise exception 'Penilai tidak boleh menilai dirinya sendiri'
      using errcode = 'P0001';
  end if;

  select * into v_period
  from public.performance_periods where id = v_review.period_id;
  if v_period.status <> 'Terbuka' then
    raise exception 'Penilaian hanya dapat diisi saat periode Terbuka'
      using errcode = 'P0001';
  end if;
  if v_review.status not in ('Draft', 'Dikembalikan') then
    raise exception 'Lembar berstatus % tidak dapat diisi', v_review.status
      using errcode = 'P0001';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Data skor penilaian tidak valid' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_scores) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Data skor penilaian tidak valid' using errcode = 'P0001';
    end if;
    v_score_id := nullif(btrim(coalesce(v_item->>'score_id', '')), '')::uuid;
    if v_score_id is null then
      raise exception 'Aspek penilaian tidak valid' using errcode = 'P0001';
    end if;
    if v_score_id = any(v_seen) then
      raise exception 'Aspek penilaian duplikat' using errcode = 'P0001';
    end if;
    v_seen := array_append(v_seen, v_score_id);

    select * into v_score
    from public.performance_review_scores
    where id = v_score_id and review_id = v_review.id
    for update;
    if not found then
      raise exception 'Aspek penilaian tidak ditemukan pada lembar ini'
        using errcode = 'P0001';
    end if;

    if coalesce(btrim(v_item->>'score'), '') = '' then
      v_score_value := null;
    else
      if (v_item->>'score') !~ '^[1-5]$' then
        raise exception 'Skor harus berupa angka 1 sampai 5'
          using errcode = 'P0001';
      end if;
      v_score_value := (v_item->>'score')::integer;
    end if;

    v_note := btrim(coalesce(v_item->>'note', ''));
    if length(v_note) > 2000 then
      raise exception 'Catatan aspek maksimal 2000 karakter'
        using errcode = 'P0001';
    end if;
    if v_score_value in (1, 2, 5) and v_note = '' then
      raise exception 'Catatan wajib diisi untuk aspek % karena skor %',
        v_score.aspect_name, v_score_value using errcode = 'P0001';
    end if;

    update public.performance_review_scores
    set score = v_score_value, note = v_note
    where id = v_score.id;
  end loop;

  v_from_status := v_review.status;
  update public.performance_reviews
  set achievement_notes = btrim(coalesce(p_achievement_notes, '')),
      strengths = btrim(coalesce(p_strengths, '')),
      improvement_areas = btrim(coalesce(p_improvement_areas, '')),
      general_notes = btrim(coalesce(p_general_notes, '')),
      last_filled_by = auth.uid(),
      last_filled_at = now()
  where id = v_review.id
  returning * into v_review;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  ) values (
    v_review.id, 'Draft Disimpan', v_from_status, v_review.status, null,
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  );

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kirim ke HR
-- ---------------------------------------------------------------------------
create or replace function public.submit_performance_review(p_review_id uuid)
returns public.performance_reviews
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_review public.performance_reviews;
  v_period public.performance_periods;
  v_actor_employee text;
  v_is_staff boolean;
  v_missing integer;
  v_invalid_notes text;
  v_average numeric;
  v_actor_name text;
  v_from_status text;
begin
  v_is_staff := public.current_has_role(array['hr_manager']);
  v_actor_employee := public.current_employee_id();

  select * into v_review
  from public.performance_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Lembar penilaian tidak ditemukan' using errcode = 'P0002';
  end if;
  if not v_is_staff and (
    public.current_app_role() is distinct from 'employee'
    or v_actor_employee is null
    or v_actor_employee is distinct from v_review.reviewer_employee_id
  ) then
    raise exception 'Akses ditolak: lembar ini bukan penugasan Anda'
      using errcode = '42501';
  end if;
  if v_actor_employee is not null and v_actor_employee = v_review.employee_id then
    raise exception 'Penilai tidak boleh menilai dirinya sendiri'
      using errcode = 'P0001';
  end if;

  select * into v_period
  from public.performance_periods where id = v_review.period_id;
  if v_period.status <> 'Terbuka' then
    raise exception 'Penilaian hanya dapat dikirim saat periode Terbuka'
      using errcode = 'P0001';
  end if;
  if v_review.status not in ('Draft', 'Dikembalikan') then
    raise exception 'Lembar berstatus % tidak dapat dikirim', v_review.status
      using errcode = 'P0001';
  end if;

  select count(*) into v_missing
  from public.performance_review_scores
  where review_id = v_review.id and score is null;
  if v_missing > 0 then
    raise exception 'Semua aspek wajib diberi skor sebelum dikirim'
      using errcode = 'P0001';
  end if;

  select string_agg(aspect_name, ', ' order by sort_order)
  into v_invalid_notes
  from public.performance_review_scores
  where review_id = v_review.id
    and score in (1, 2, 5)
    and btrim(note) = '';
  if v_invalid_notes is not null then
    raise exception 'Catatan wajib diisi untuk aspek: % (skor 1, 2, atau 5)',
      v_invalid_notes using errcode = 'P0001';
  end if;

  if btrim(v_review.achievement_notes) = '' then
    raise exception 'Catatan Pencapaian Utama wajib diisi sebelum dikirim'
      using errcode = 'P0001';
  end if;

  select round(avg(score)::numeric, 2) into v_average
  from public.performance_review_scores where review_id = v_review.id;

  v_from_status := v_review.status;
  update public.performance_reviews
  set status = 'Dikirim',
      final_score = v_average,
      final_category = public.performance_category_for_score(v_average),
      submitted_by = auth.uid(),
      submitted_at = now(),
      return_reason = null,
      last_filled_by = auth.uid(),
      last_filled_at = now()
  where id = v_review.id
  returning * into v_review;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  ) values (
    v_review.id, 'Dikirim', v_from_status, 'Dikirim', null,
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  );

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review HR
-- ---------------------------------------------------------------------------
create or replace function public.return_performance_review(
  p_review_id uuid,
  p_reason text
)
returns public.performance_reviews
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_review public.performance_reviews;
  v_period public.performance_periods;
  v_reason text;
  v_actor_name text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengembalikan penilaian'
      using errcode = '42501';
  end if;
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan pengembalian wajib diisi' using errcode = 'P0001';
  end if;

  select * into v_review
  from public.performance_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Lembar penilaian tidak ditemukan' using errcode = 'P0002';
  end if;
  select * into v_period
  from public.performance_periods where id = v_review.period_id;
  if v_period.status <> 'Terbuka' then
    raise exception 'Penilaian hanya dapat dikembalikan saat periode Terbuka'
      using errcode = 'P0001';
  end if;
  if v_review.status <> 'Dikirim' then
    raise exception 'Hanya lembar Dikirim yang dapat dikembalikan'
      using errcode = 'P0001';
  end if;

  update public.performance_reviews
  set status = 'Dikembalikan',
      return_reason = v_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = v_review.id
  returning * into v_review;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  ) values (
    v_review.id, 'Dikembalikan', 'Dikirim', 'Dikembalikan', v_reason,
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  );

  return v_review;
end;
$$;

create or replace function public.approve_performance_review(p_review_id uuid)
returns public.performance_reviews
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_review public.performance_reviews;
  v_period public.performance_periods;
  v_missing integer;
  v_average numeric;
  v_actor_name text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menyetujui penilaian'
      using errcode = '42501';
  end if;

  select * into v_review
  from public.performance_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Lembar penilaian tidak ditemukan' using errcode = 'P0002';
  end if;
  select * into v_period
  from public.performance_periods where id = v_review.period_id;
  if v_period.status <> 'Terbuka' then
    raise exception 'Penilaian hanya dapat disetujui saat periode Terbuka'
      using errcode = 'P0001';
  end if;
  if v_review.status <> 'Dikirim' then
    raise exception 'Hanya lembar Dikirim yang dapat disetujui'
      using errcode = 'P0001';
  end if;

  select count(*) into v_missing
  from public.performance_review_scores
  where review_id = v_review.id and score is null;
  if v_missing > 0 then
    raise exception 'Skor aspek belum lengkap; minta penilai melengkapi'
      using errcode = 'P0001';
  end if;
  if btrim(v_review.achievement_notes) = '' then
    raise exception 'Catatan Pencapaian Utama masih kosong'
      using errcode = 'P0001';
  end if;

  select round(avg(score)::numeric, 2) into v_average
  from public.performance_review_scores where review_id = v_review.id;

  update public.performance_reviews
  set status = 'Final',
      final_score = v_average,
      final_category = public.performance_category_for_score(v_average),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = v_review.id
  returning * into v_review;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  ) values (
    v_review.id, 'Disetujui', 'Dikirim', 'Final', null,
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  );

  return v_review;
end;
$$;

create or replace function public.exclude_performance_review(
  p_review_id uuid,
  p_reason text
)
returns public.performance_reviews
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_review public.performance_reviews;
  v_period public.performance_periods;
  v_reason text;
  v_actor_name text;
  v_from_status text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengecualikan penilaian'
      using errcode = '42501';
  end if;
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan pengecualian wajib diisi' using errcode = 'P0001';
  end if;

  select * into v_review
  from public.performance_reviews where id = p_review_id for update;
  if not found then
    raise exception 'Lembar penilaian tidak ditemukan' using errcode = 'P0002';
  end if;
  select * into v_period
  from public.performance_periods where id = v_review.period_id;
  if v_period.status <> 'Terbuka' then
    raise exception 'Penilaian hanya dapat dikecualikan saat periode Terbuka'
      using errcode = 'P0001';
  end if;
  if v_review.status = 'Final' then
    raise exception 'Lembar Final terkunci dan tidak dapat dikecualikan'
      using errcode = 'P0001';
  end if;

  v_from_status := v_review.status;

  update public.performance_reviews
  set status = 'Dikecualikan',
      excluded_reason = v_reason,
      excluded_by = auth.uid(),
      excluded_at = now()
  where id = v_review.id
  returning * into v_review;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  ) values (
    v_review.id, 'Dikecualikan', v_from_status, 'Dikecualikan', v_reason,
    auth.uid(), coalesce(v_actor_name, 'Sistem')
  );

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tutup periode
-- ---------------------------------------------------------------------------
create or replace function public.close_performance_period(p_period_id uuid)
returns public.performance_periods
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_period public.performance_periods;
  v_actor_name text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menutup periode'
      using errcode = '42501';
  end if;

  select * into v_period
  from public.performance_periods where id = p_period_id for update;
  if not found then
    raise exception 'Periode tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_period.status <> 'Terbuka' then
    raise exception 'Periode sudah ditutup dan tidak dapat dibuka kembali'
      using errcode = 'P0001';
  end if;

  select coalesce(p.full_name, 'Sistem') into v_actor_name
  from public.user_profiles p where p.id = auth.uid();

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  )
  select id, 'Tidak Lengkap', status, 'Tidak lengkap',
         format('Periode %s ditutup', v_period.name),
         auth.uid(), coalesce(v_actor_name, 'Sistem')
  from public.performance_reviews
  where period_id = v_period.id and status not in ('Final', 'Dikecualikan');

  update public.performance_reviews
  set status = 'Tidak lengkap'
  where period_id = v_period.id and status not in ('Final', 'Dikecualikan');

  update public.performance_periods
  set status = 'Ditutup',
      closed_by = auth.uid(),
      closed_at = now()
  where id = v_period.id
  returning * into v_period;

  return v_period;
end;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE fungsi
-- ---------------------------------------------------------------------------
revoke all on function public.save_performance_aspect(uuid, text, text, integer, boolean)
  from public, anon;
revoke all on function public.create_performance_period(text, date, date, date)
  from public, anon;
revoke all on function public.set_performance_reviewer(uuid, text, text)
  from public, anon;
revoke all on function public.save_performance_draft(uuid, jsonb, text, text, text, text)
  from public, anon;
revoke all on function public.submit_performance_review(uuid)
  from public, anon;
revoke all on function public.return_performance_review(uuid, text)
  from public, anon;
revoke all on function public.approve_performance_review(uuid)
  from public, anon;
revoke all on function public.exclude_performance_review(uuid, text)
  from public, anon;
revoke all on function public.close_performance_period(uuid)
  from public, anon;

grant execute on function public.save_performance_aspect(uuid, text, text, integer, boolean)
  to authenticated, service_role;
grant execute on function public.create_performance_period(text, date, date, date)
  to authenticated, service_role;
grant execute on function public.set_performance_reviewer(uuid, text, text)
  to authenticated, service_role;
grant execute on function public.save_performance_draft(uuid, jsonb, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.submit_performance_review(uuid)
  to authenticated, service_role;
grant execute on function public.return_performance_review(uuid, text)
  to authenticated, service_role;
grant execute on function public.approve_performance_review(uuid)
  to authenticated, service_role;
grant execute on function public.exclude_performance_review(uuid, text)
  to authenticated, service_role;
grant execute on function public.close_performance_period(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed aspek awal
-- ---------------------------------------------------------------------------
insert into public.performance_aspects (name, description, sort_order)
select v.name, v.description, v.sort_order
from (values
  ('Kualitas Kerja', 'Ketelitian, kelengkapan, dan mutu hasil kerja.', 1),
  ('Ketepatan Waktu dan Target', 'Kemampuan menyelesaikan pekerjaan sesuai tenggat dan target.', 2),
  ('Tanggung Jawab', 'Konsistensi memenuhi komitmen dan mengelola risiko pekerjaan.', 3),
  ('Kerja Sama', 'Kolaborasi dengan rekan, atasan, dan lintas departemen.', 4),
  ('Inisiatif', 'Prakarsa memperbaiki cara kerja dan menyelesaikan masalah.', 5),
  ('Kedisiplinan', 'Kepatuhan pada aturan, jadwal, dan prosedur perusahaan.', 6)
) as v(name, description, sort_order)
where not exists (select 1 from public.performance_aspects);

-- ---------------------------------------------------------------------------
-- Seed demo: periode Semester 2 2026 (Terbuka, tanpa approval)
-- ---------------------------------------------------------------------------
do $$
declare
  v_period public.performance_periods;
  v_actor uuid;
  v_ineligible jsonb;
begin
  if exists (
    select 1 from public.performance_periods
    where name = '[DEMO] Semester 2 2026'
  ) then
    return;
  end if;
  if exists (select 1 from public.performance_periods where status = 'Terbuka') then
    return;
  end if;

  select ur.user_id into v_actor
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where r.name = 'admin'
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'employee_id', e.id,
    'employee_name', e.full_name,
    'reason', case
      when e.status not in ('Aktif', 'Probation') then 'Status ' || e.status
      else 'Masa kerja belum 3 bulan'
    end
  ) order by e.full_name), '[]'::jsonb)
  into v_ineligible
  from public.employees e
  where not (
    e.status in ('Aktif', 'Probation')
    and e.joined_at <= ('2026-12-31'::date - interval '3 months')::date
  );

  insert into public.performance_periods (
    name, start_date, end_date, due_date, status, ineligible_employees, opened_by
  ) values (
    '[DEMO] Semester 2 2026', '2026-07-01', '2026-12-31', '2027-01-15',
    'Terbuka', v_ineligible, v_actor
  ) returning * into v_period;

  insert into public.performance_reviews (
    period_id, employee_id, employee_name, department, position,
    reviewer_employee_id, reviewer_name, reviewer_department, reviewer_position
  )
  select
    v_period.id, e.id, e.full_name, e.department, e.position,
    m.id, m.full_name, m.department, m.position
  from public.employees e
  left join public.employees m on m.id = e.manager_id
  where e.status in ('Aktif', 'Probation')
    and e.joined_at <= ('2026-12-31'::date - interval '3 months')::date;

  insert into public.performance_review_scores (
    review_id, aspect_id, aspect_name, aspect_description, sort_order
  )
  select r.id, a.id, a.name, a.description, a.sort_order
  from public.performance_reviews r
  cross join public.performance_aspects a
  where r.period_id = v_period.id and a.is_active;

  insert into public.performance_review_history (
    review_id, action, from_status, to_status, reason, actor_id, actor_name
  )
  select r.id, 'Dibuat', null, 'Draft',
         format('Snapshot periode %s', v_period.name),
         v_actor, 'Sistem Demo'
  from public.performance_reviews r
  where r.period_id = v_period.id;
end;
$$;

notify pgrst, 'reload schema';
