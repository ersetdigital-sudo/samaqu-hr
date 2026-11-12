-- Ubah data pelamar (nama, WhatsApp, email, kota) + riwayat per kolom.

create table if not exists public.job_application_data_history (
  id bigserial primary key,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  column_name text not null,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamp with time zone not null default now(),
  constraint job_application_data_history_column_check check (
    column_name in ('full_name', 'whatsapp', 'email', 'city')
  )
);

comment on column public.job_application_data_history.changed_by is
  'auth.uid() pelaku; tanpa foreign key agar tetap ada setelah akun dihapus.';

create index if not exists job_application_data_history_list_idx
  on public.job_application_data_history (application_id, changed_at desc);

-- Satu baris per kolom yang berubah, dari jalur update mana pun.
create or replace function public.log_job_application_data_change()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
begin
  if new.full_name is distinct from old.full_name then
    insert into public.job_application_data_history
      (application_id, column_name, old_value, new_value, changed_by, changed_at)
    values (new.id, 'full_name', old.full_name, new.full_name, auth.uid(), now());
  end if;

  if new.whatsapp is distinct from old.whatsapp then
    insert into public.job_application_data_history
      (application_id, column_name, old_value, new_value, changed_by, changed_at)
    values (new.id, 'whatsapp', old.whatsapp, new.whatsapp, auth.uid(), now());
  end if;

  if new.email is distinct from old.email then
    insert into public.job_application_data_history
      (application_id, column_name, old_value, new_value, changed_by, changed_at)
    values (new.id, 'email', old.email, new.email, auth.uid(), now());
  end if;

  if new.city is distinct from old.city then
    insert into public.job_application_data_history
      (application_id, column_name, old_value, new_value, changed_by, changed_at)
    values (new.id, 'city', old.city, new.city, auth.uid(), now());
  end if;

  return new;
end;
$function$;

revoke execute on function public.log_job_application_data_change()
  from public, anon, authenticated;

drop trigger if exists job_applications_data_history on public.job_applications;
create trigger job_applications_data_history
  after update of full_name, whatsapp, email, city on public.job_applications
  for each row execute function public.log_job_application_data_change();

alter table public.job_application_data_history enable row level security;

drop policy if exists job_application_data_history_staff_read
  on public.job_application_data_history;
create policy job_application_data_history_staff_read
  on public.job_application_data_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager', 'recruiter']));

revoke all on public.job_application_data_history from anon;
revoke insert, update, delete on public.job_application_data_history
  from authenticated;
grant select on public.job_application_data_history
  to authenticated, service_role;

-- Ubah empat kolom kontak; role + penjagaan karyawan + validasi di database.
create or replace function public.update_application_contact(
  p_application_id uuid,
  p_full_name text,
  p_whatsapp text,
  p_email text,
  p_city text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  v_app public.job_applications;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_whatsapp text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_city text := btrim(coalesce(p_city, ''));
begin
  if not public.current_has_role(array['hr_manager', 'recruiter']) then
    raise exception 'Akses ditolak: hanya HR Manager atau Recruiter yang dapat mengubah data pelamar'
      using errcode = '42501';
  end if;

  select * into v_app
  from public.job_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Pelamar tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_app.employee_id is not null then
    raise exception 'Data sudah menjadi data karyawan, koreksi lewat Direktori Karyawan'
      using errcode = '23514';
  end if;

  v_whatsapp := regexp_replace(coalesce(p_whatsapp, ''), '[\s()+-]', '', 'g');
  if v_whatsapp like '0%' then
    v_whatsapp := '62' || substr(v_whatsapp, 2);
  elsif v_whatsapp not like '62%' then
    v_whatsapp := '62' || v_whatsapp;
  end if;

  if length(v_name) < 1 or length(v_name) > 150 then
    raise exception 'Nama lengkap wajib diisi (maksimal 150 karakter)'
      using errcode = '23514';
  end if;

  if v_whatsapp !~ '^628[0-9]{7,11}$' then
    raise exception 'Nomor WhatsApp Indonesia tidak valid'
      using errcode = '23514';
  end if;

  if length(v_email) > 254 or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Alamat email tidak valid' using errcode = '23514';
  end if;

  if length(v_city) < 1 or length(v_city) > 100 then
    raise exception 'Kota wajib diisi (maksimal 100 karakter)'
      using errcode = '23514';
  end if;

  if v_name is not distinct from v_app.full_name
    and v_whatsapp is not distinct from v_app.whatsapp
    and v_email is not distinct from v_app.email
    and v_city is not distinct from v_app.city then
    raise exception 'Tidak ada perubahan data' using errcode = '23514';
  end if;

  update public.job_applications
  set
    full_name = v_name,
    whatsapp = v_whatsapp,
    email = v_email,
    city = v_city
  where id = p_application_id;

  return jsonb_build_object(
    'full_name', v_name,
    'whatsapp', v_whatsapp,
    'email', v_email,
    'city', v_city
  );
end;
$function$;

revoke execute on function public.update_application_contact(
  uuid, text, text, text, text
) from public, anon;
grant execute on function public.update_application_contact(
  uuid, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
