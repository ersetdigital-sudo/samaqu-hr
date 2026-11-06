-- =============================================================================
-- 20261103210000_auth_user_management.sql
-- Fondasi Authentication & Authorization HRIS Samaqu.
--
--  * roles / user_profiles / user_roles / user_access_history
--  * helper otorisasi berbasis auth.uid() (SECURITY DEFINER, search_path aman)
--  * RLS berbasis role, bukan sekadar "sudah login"
--  * audit perubahan peran & status akun lewat trigger
--
-- Aditif: tidak mengubah data karyawan/kontrak existing.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabel
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name in ('admin', 'hr_manager', 'recruiter', 'employee')),
  description text,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description) values
  ('admin', 'Administrasi sistem dan pengelolaan akun pengguna'),
  ('hr_manager', 'Pengelolaan data HRIS, karyawan, dan kontrak'),
  ('recruiter', 'Modul rekrutmen'),
  ('employee', 'Akses terbatas untuk karyawan')
on conflict (name) do nothing;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_id text references public.employees (id) on delete set null,
  full_name text not null check (length(btrim(full_name)) > 0),
  email text not null unique,
  account_status text not null default 'Diundang'
    check (account_status in ('Aktif', 'Nonaktif', 'Diundang')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is
  'Profil akun aplikasi. Status akun login terpisah dari status kepegawaian.';

create table if not exists public.user_roles (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (user_id, role_id)
);

create table if not exists public.user_access_history (
  id bigserial primary key,
  user_id uuid not null,
  action text not null
    check (action in (
      'Akun Dibuat',
      'Peran Ditambahkan',
      'Peran Diubah',
      'Status Akun',
      'Undangan Dikirim',
      'Reset Password'
    )),
  from_value text,
  to_value text,
  reason text,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

create index if not exists user_access_history_user_idx
  on public.user_access_history (user_id, changed_at desc);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Helper otorisasi (sumber tunggal role dari database)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.user_profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid()
    and p.account_status = 'Aktif'
  order by case r.name
    when 'admin' then 1
    when 'hr_manager' then 2
    when 'recruiter' then 3
    else 4
  end
  limit 1;
$$;

create or replace function public.current_has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = any (roles), false);
$$;

create or replace function public.current_employee_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.employee_id
  from public.user_profiles p
  where p.id = auth.uid()
    and p.account_status = 'Aktif'
  limit 1;
$$;

comment on function public.current_app_role() is
  'Role aktif pengguna dari database. NULL bila belum punya profil/role atau akun tidak Aktif.';

revoke execute on function public.current_app_role() from anon;
revoke execute on function public.current_has_role(text[]) from anon;
revoke execute on function public.current_employee_id() from anon;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.current_has_role(text[]) to authenticated, service_role;
grant execute on function public.current_employee_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Audit peran & status akun (trigger = tidak bisa dilewati aplikasi)
-- ---------------------------------------------------------------------------
create or replace function public.log_user_access_change()
returns trigger
language plpgsql
as $$
declare
  v_role_name text;
  v_reason text;
begin
  v_reason := nullif(btrim(coalesce(current_setting('hr.access_reason', true), '')), '');

  if tg_table_name = 'user_roles' then
    select name into v_role_name from public.roles where id = coalesce(new.role_id, old.role_id);

    insert into public.user_access_history (user_id, action, from_value, to_value, reason, changed_by)
    values (
      coalesce(new.user_id, old.user_id),
      case when tg_op = 'INSERT' then 'Peran Ditambahkan' else 'Peran Diubah' end,
      case when tg_op = 'DELETE' then v_role_name else null end,
      case when tg_op = 'INSERT' then v_role_name else null end,
      v_reason,
      auth.uid()
    );
    return coalesce(new, old);
  end if;

  -- user_profiles
  if tg_op = 'INSERT' then
    insert into public.user_access_history (user_id, action, from_value, to_value, changed_by)
    values (new.id, 'Akun Dibuat', null, new.account_status, auth.uid());
    return new;
  end if;

  if new.account_status is distinct from old.account_status then
    insert into public.user_access_history (user_id, action, from_value, to_value, reason, changed_by)
    values (
      new.id, 'Status Akun', old.account_status, new.account_status, v_reason, auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists user_roles_log_change on public.user_roles;
create trigger user_roles_log_change
  after insert or delete on public.user_roles
  for each row execute function public.log_user_access_change();

drop trigger if exists user_profiles_log_change on public.user_profiles;
create trigger user_profiles_log_change
  after insert or update on public.user_profiles
  for each row execute function public.log_user_access_change();

-- ---------------------------------------------------------------------------
-- 4. RLS: role dari database, bukan "auth.uid() is not null"
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_access_history enable row level security;

-- roles: boleh dibaca pengguna aktif (untuk label), dikelola admin.
drop policy if exists roles_read_active on public.roles;
create policy roles_read_active on public.roles
  for select to authenticated
  using (public.current_app_role() is not null or public.current_has_role(array['admin']));

drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles
  for all to authenticated
  using (public.current_has_role(array['admin']))
  with check (public.current_has_role(array['admin']));

-- user_profiles: pemilik boleh baca barisnya, admin penuh.
drop policy if exists user_profiles_read_self on public.user_profiles;
create policy user_profiles_read_self on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.current_has_role(array['admin']));

drop policy if exists user_profiles_admin_write on public.user_profiles;
create policy user_profiles_admin_write on public.user_profiles
  for insert to authenticated
  with check (public.current_has_role(array['admin']));

drop policy if exists user_profiles_admin_update on public.user_profiles;
create policy user_profiles_admin_update on public.user_profiles
  for update to authenticated
  using (public.current_has_role(array['admin']))
  with check (public.current_has_role(array['admin']));

-- user_roles: baca milik sendiri, kelola hanya admin.
drop policy if exists user_roles_read_self on public.user_roles;
create policy user_roles_read_self on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.current_has_role(array['admin']));

drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.current_has_role(array['admin']))
  with check (public.current_has_role(array['admin']));

-- user_access_history: hanya admin.
drop policy if exists user_access_history_admin on public.user_access_history;
create policy user_access_history_admin on public.user_access_history
  for select to authenticated
  using (public.current_has_role(array['admin']));

drop policy if exists user_access_history_admin_insert on public.user_access_history;
create policy user_access_history_admin_insert on public.user_access_history
  for insert to authenticated
  with check (public.current_has_role(array['admin']));

-- Data HRIS: HR Manager penuh; karyawan hanya barisnya sendiri bila tertaut.
drop policy if exists employees_hr_all on public.employees;
create policy employees_hr_all on public.employees
  for all to authenticated
  using (public.current_has_role(array['hr_manager']))
  with check (public.current_has_role(array['hr_manager']));

drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
  for select to authenticated
  using (id = public.current_employee_id());

drop policy if exists contracts_hr_all on public.contracts;
create policy contracts_hr_all on public.contracts
  for all to authenticated
  using (public.current_has_role(array['hr_manager']))
  with check (public.current_has_role(array['hr_manager']));

drop policy if exists contract_history_hr_read on public.contract_history;
create policy contract_history_hr_read on public.contract_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists contract_history_hr_insert on public.contract_history;
create policy contract_history_hr_insert on public.contract_history
  for insert to authenticated
  with check (public.current_has_role(array['hr_manager']));

drop policy if exists employee_status_history_hr_read on public.employee_status_history;
create policy employee_status_history_hr_read on public.employee_status_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

drop policy if exists employee_status_history_hr_insert on public.employee_status_history;
create policy employee_status_history_hr_insert on public.employee_status_history
  for insert to authenticated
  with check (public.current_has_role(array['hr_manager']));

-- ---------------------------------------------------------------------------
-- 5. Hak tabel (RLS tetap penyaring baris)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert on public.user_access_history to authenticated;

grant usage, select on sequence public.user_roles_id_seq to authenticated;
grant usage, select on sequence public.user_access_history_id_seq to authenticated;

grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert on public.contract_history to authenticated;
grant select, insert on public.employee_status_history to authenticated;
grant usage, select on sequence public.employee_id_seq to authenticated;
grant usage, select on sequence public.contract_number_seq to authenticated;
grant usage, select on sequence public.contract_history_id_seq to authenticated;
grant usage, select on sequence public.employee_status_history_id_seq to authenticated;

commit;

notify pgrst, 'reload schema';
