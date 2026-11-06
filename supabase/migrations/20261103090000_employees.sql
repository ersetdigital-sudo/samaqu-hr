-- =============================================================================
-- 20261103090000_employees.sql
-- Tabel induk karyawan HRIS Samaqu.
--
-- Aturan penting:
--  * Employee ID (SQ-EMP-0001) adalah identitas utama seluruh modul HRIS.
--    Dibuat database lewat sequence — jangan pernah mengisi manual.
--  * NIK KTP disimpan sebagai text (angka 16 digit, leading zero aman) dan
--    hanya boleh dibaca lewat API detail oleh role berhak.
--  * RLS aktif tanpa policy: akses data hanya dari server (service role).
--    Policy per-role ditambahkan saat autentikasi asli dipasang.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Sequence terpisah supaya ID tetap berurutan walau ada baris dihapus.
create sequence if not exists public.employee_id_seq as bigint start with 1;

create or replace function public.employee_id_from_sequence(seq bigint)
returns text
language sql
immutable
as $$
  select 'SQ-EMP-' || lpad(seq::text, 4, '0');
$$;

create table if not exists public.employees (
  id text primary key
    default public.employee_id_from_sequence(nextval('public.employee_id_seq')),

  -- Data pekerjaan
  full_name text not null check (length(btrim(full_name)) > 0),
  position text not null check (length(btrim(position)) > 0),
  department text not null check (length(btrim(department)) > 0),
  location text not null check (length(btrim(location)) > 0),
  manager_id text,
  joined_at date not null,
  employment_type text not null
    check (employment_type in ('Tetap', 'Kontrak', 'Magang', 'Harian')),
  status text not null default 'Aktif'
    check (status in ('Aktif', 'Probation', 'Nonaktif')),

  -- Identitas
  gender text not null check (gender in ('Laki-laki', 'Perempuan')),
  birth_place text not null check (length(btrim(birth_place)) > 0),
  birth_date date not null,
  address text not null check (length(btrim(address)) > 0),
  nik text not null unique check (nik ~ '^[0-9]{16}$'),

  -- Kontak (email pribadi & kerja dipisah)
  personal_email text not null check (position('@' in personal_email) > 1),
  work_email text not null unique check (position('@' in work_email) > 1),
  phone text not null check (length(btrim(phone)) > 0),
  emergency_name text not null,
  emergency_relation text not null,
  emergency_phone text not null,

  -- Probation & kontrak ringkas
  probation_start date,
  probation_end date,
  contract_end date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employees_manager_fkey
    foreign key (manager_id) references public.employees (id)
    on delete set null,
  constraint employees_probation_order
    check (
      probation_start is null
      or probation_end is null
      or probation_end >= probation_start
    ),
  constraint employees_manager_not_self
    check (manager_id is null or manager_id <> id)
);

comment on table public.employees is
  'Data induk karyawan. Employee ID dipakai lintas modul HRIS.';
comment on column public.employees.nik is
  'Data sensitif: hanya boleh dibaca lewat API detail (role hr_manager).';

-- Kolom yang dipakai filter/pencarian direktori.
create index if not exists employees_status_idx
  on public.employees (status);
create index if not exists employees_department_idx
  on public.employees (department);
create index if not exists employees_employment_type_idx
  on public.employees (employment_type);
create index if not exists employees_location_idx
  on public.employees (location);
create index if not exists employees_joined_at_idx
  on public.employees (joined_at desc);
create index if not exists employees_manager_id_idx
  on public.employees (manager_id);

-- Pencarian nama / Employee ID / jabatan (ILIKE '%…%').
create index if not exists employees_search_trgm_idx
  on public.employees
  using gin ((full_name || ' ' || id || ' ' || position) extensions.gin_trgm_ops);

-- updated_at otomatis, dipakai ulang oleh modul lain.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- Pratinjau Employee ID berikutnya untuk form (server tetap penentu akhir).
create or replace function public.employee_id_preview()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.employee_id_from_sequence(
    case when is_called then last_value + 1 else last_value end
  )
  from public.employee_id_seq;
$$;

comment on function public.employee_id_preview() is
  'Pratinjau SQ-EMP-xxxx berikutnya; tidak memakai/menggeser sequence.';

-- ---------------------------------------------------------------------------
-- Keamanan
-- RLS aktif tanpa policy => anon/authenticated tidak bisa baca/tulis langsung.
-- Server memakai service role (bypass RLS). Saat auth asli dipasang, tambahkan
-- policy berbasis role di migration baru.
-- ---------------------------------------------------------------------------
alter table public.employees enable row level security;

revoke all on table public.employees from anon, authenticated;
revoke all on sequence public.employee_id_seq from anon, authenticated;
revoke execute on function public.employee_id_preview() from anon, authenticated;

grant select, insert, update, delete on table public.employees to service_role;
grant usage, select on sequence public.employee_id_seq to service_role;
grant execute on function public.employee_id_preview() to service_role;
grant execute on function public.employee_id_from_sequence(bigint) to service_role;
