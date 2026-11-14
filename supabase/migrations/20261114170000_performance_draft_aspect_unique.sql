-- ---------------------------------------------------------------------------
-- Performance Management: draft longgar + nama aspek unik.
--
--  * save_performance_draft tidak lagi mewajibkan catatan skor 1/2/5 atau
--    Catatan Pencapaian Utama. Aturan itu tetap berlaku di submit.
--  * Nama aspek unik tanpa membedakan huruf besar/kecil dan spasi ujung.
-- ---------------------------------------------------------------------------

create unique index if not exists performance_aspects_normalized_name_idx
  on public.performance_aspects (lower(btrim(name)));

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

  if exists (
    select 1
    from public.performance_aspects
    where lower(btrim(name)) = lower(v_name)
      and (p_aspect_id is null or id <> p_aspect_id)
  ) then
    raise exception 'Nama aspek sudah digunakan: %', v_name
      using errcode = 'P0001';
  end if;

  begin
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
  exception
    when unique_violation then
      raise exception 'Nama aspek sudah digunakan: %', v_name
        using errcode = 'P0001';
  end;
end;
$$;

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

revoke all on function public.save_performance_aspect(uuid, text, text, integer, boolean)
  from public, anon;
revoke all on function public.save_performance_draft(uuid, jsonb, text, text, text, text)
  from public, anon;

grant execute on function public.save_performance_aspect(uuid, text, text, integer, boolean)
  to authenticated, service_role;
grant execute on function public.save_performance_draft(uuid, jsonb, text, text, text, text)
  to authenticated, service_role;
