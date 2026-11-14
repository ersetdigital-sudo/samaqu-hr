-- =============================================================================
-- 20261113120000_payroll_module.sql
-- Payroll: profil gaji, pengaturan tarif, run bulanan, snapshot, slip.
--
--  * Data sensitif (gaji, NPWP, BPJS, rekening) hanya staf payroll.
--  * Karyawan hanya bisa membaca slip miliknya yang Final/Dibayar via RPC.
--  * Perhitungan dilakukan aplikasi; RPC menyimpan snapshot dan riwayat atomik.
--  * TER bulanan mengikuti Lampiran PMK 168 Tahun 2023 (A/B/C).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Profil payroll
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_profiles (
  employee_id text primary key
    references public.employees (id) on delete cascade,
  base_salary numeric(14,2) not null default 0
    check (base_salary >= 0),
  fixed_allowance numeric(14,2) not null default 0
    check (fixed_allowance >= 0),
  variable_allowance numeric(14,2) not null default 0
    check (variable_allowance >= 0),
  ptkp_status text
    check (
      ptkp_status is null
      or ptkp_status in ('TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3')
    ),
  npwp text
    check (npwp is null or length(btrim(npwp)) <= 30),
  bpjs_kesehatan_number text
    check (bpjs_kesehatan_number is null or length(btrim(bpjs_kesehatan_number)) <= 30),
  bpjs_ketenagakerjaan_number text
    check (bpjs_ketenagakerjaan_number is null or length(btrim(bpjs_ketenagakerjaan_number)) <= 30),
  bank_name text
    check (bank_name is null or length(btrim(bank_name)) <= 100),
  bank_account_number text
    check (bank_account_number is null or length(btrim(bank_account_number)) <= 40),
  bank_account_holder text
    check (bank_account_holder is null or length(btrim(bank_account_holder)) <= 150),
  jkk_risk_class text not null default 'very_low'
    check (jkk_risk_class in ('very_low','low','medium','high','very_high')),
  effective_date date not null default current_date,
  notes text
    check (notes is null or length(notes) <= 500),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists payroll_profiles_set_updated_at on public.payroll_profiles;
create trigger payroll_profiles_set_updated_at
  before update on public.payroll_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_profile_history (
  id bigserial primary key,
  employee_id text not null,
  old_data jsonb,
  new_data jsonb not null,
  reason text not null
    check (length(btrim(reason)) between 1 and 1000),
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists payroll_profile_history_employee_idx
  on public.payroll_profile_history (employee_id, changed_at desc);

comment on table public.payroll_profiles is
  'Profil payroll sensitif; hanya staf payroll yang boleh membaca langsung.';

-- ---------------------------------------------------------------------------
-- 2. Pengaturan payroll
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_settings (
  id boolean primary key default true check (id),
  settings jsonb not null,
  effective_date date not null default current_date,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists payroll_settings_set_updated_at on public.payroll_settings;
create trigger payroll_settings_set_updated_at
  before update on public.payroll_settings
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_settings_history (
  id bigserial primary key,
  old_settings jsonb,
  new_settings jsonb not null,
  effective_date date not null,
  reason text not null
    check (length(btrim(reason)) between 1 and 1000),
  changed_by uuid,
  changed_at timestamptz not null default now()
);

insert into public.payroll_settings (id, settings, effective_date)
values (
  true,
  jsonb_build_object(
    'bpjsKesehatan', jsonb_build_object(
      'employerRate', 4,
      'employeeRate', 1,
      'salaryCap', 12000000,
      'salaryFloor', null
    ),
    'jht', jsonb_build_object('employerRate', 3.7, 'employeeRate', 2),
    'jp', jsonb_build_object(
      'employerRate', 2,
      'employeeRate', 1,
      'salaryCap', 10547400
    ),
    'jkkRiskRates', jsonb_build_object(
      'very_low', 0.24,
      'low', 0.54,
      'medium', 0.89,
      'high', 1.27,
      'very_high', 1.74
    ),
    'jkmRate', 0.30,
    'overtimeDivisor', 173,
    'alfaDivisor', 26,
    'lateDeduction', jsonb_build_object(
      'enabled', false,
      'mode', 'per_minute',
      'amount', 0,
      'basis', 'tolerance'
    ),
    'biayaJabatan', jsonb_build_object(
      'rate', 5,
      'maxMonthly', 500000,
      'maxYearly', 6000000
    ),
    'ptkpTable', jsonb_build_object(
      'TK/0', 54000000,
      'TK/1', 58500000,
      'TK/2', 63000000,
      'TK/3', 67500000,
      'K/0', 58500000,
      'K/1', 63000000,
      'K/2', 67500000,
      'K/3', 72000000
    ),
    'progressiveBrackets', jsonb_build_array(
      jsonb_build_object('upTo', 60000000, 'rate', 5),
      jsonb_build_object('upTo', 250000000, 'rate', 15),
      jsonb_build_object('upTo', 500000000, 'rate', 25),
      jsonb_build_object('upTo', 5000000000, 'rate', 30),
      jsonb_build_object('upTo', null, 'rate', 35)
    ),
    'terCategoryMap', jsonb_build_object(
      'TK/0', 'A',
      'TK/1', 'A',
      'K/0', 'A',
      'TK/2', 'B',
      'TK/3', 'B',
      'K/1', 'B',
      'K/2', 'B',
      'K/3', 'C'
    ),
    'sourceNotes', jsonb_build_object(
      'ter', 'Lampiran PMK 168 Tahun 2023 (pajak.go.id/JDIH Kemenkeu).',
      'jp', 'Batas upah JP sering berubah; verifikasi ke BPJS Ketenagakerjaan sebelum payroll final.',
      'bpjs', 'Tarif dan batas BPJS dapat berubah; verifikasi sebelum payroll final.',
      'general', 'Semua tarif dan batas dapat diubah HR/Admin lewat Pengaturan Payroll.'
    )
  ),
  '2026-01-01'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Tabel TER resmi PMK 168/2023
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_ter_rates (
  category text not null check (category in ('A', 'B', 'C')),
  layer_no integer not null check (layer_no > 0),
  up_to numeric(16,2),
  rate_percent numeric(6,2) not null check (rate_percent >= 0),
  source text not null default 'PMK 168 Tahun 2023',
  primary key (category, layer_no)
);

comment on table public.payroll_ter_rates is
  'Tarif Efektif Bulanan PMK 168/2023 kategori A/B/C; up_to NULL berarti lapisan terakhir.';

insert into public.payroll_ter_rates (category, layer_no, up_to, rate_percent, source) values
('A',1,5400000,0.00,'PMK 168 Tahun 2023'),
('A',2,5650000,0.25,'PMK 168 Tahun 2023'),
('A',3,5950000,0.50,'PMK 168 Tahun 2023'),
('A',4,6300000,0.75,'PMK 168 Tahun 2023'),
('A',5,6750000,1.00,'PMK 168 Tahun 2023'),
('A',6,7500000,1.25,'PMK 168 Tahun 2023'),
('A',7,8550000,1.50,'PMK 168 Tahun 2023'),
('A',8,9650000,1.75,'PMK 168 Tahun 2023'),
('A',9,10050000,2.00,'PMK 168 Tahun 2023'),
('A',10,10350000,2.25,'PMK 168 Tahun 2023'),
('A',11,10700000,2.50,'PMK 168 Tahun 2023'),
('A',12,11050000,3.00,'PMK 168 Tahun 2023'),
('A',13,11600000,3.50,'PMK 168 Tahun 2023'),
('A',14,12500000,4.00,'PMK 168 Tahun 2023'),
('A',15,13750000,5.00,'PMK 168 Tahun 2023'),
('A',16,15100000,6.00,'PMK 168 Tahun 2023'),
('A',17,16950000,7.00,'PMK 168 Tahun 2023'),
('A',18,19750000,8.00,'PMK 168 Tahun 2023'),
('A',19,24150000,9.00,'PMK 168 Tahun 2023'),
('A',20,26450000,10.00,'PMK 168 Tahun 2023'),
('A',21,28000000,11.00,'PMK 168 Tahun 2023'),
('A',22,30050000,12.00,'PMK 168 Tahun 2023'),
('A',23,32400000,13.00,'PMK 168 Tahun 2023'),
('A',24,35400000,14.00,'PMK 168 Tahun 2023'),
('A',25,39100000,15.00,'PMK 168 Tahun 2023'),
('A',26,43850000,16.00,'PMK 168 Tahun 2023'),
('A',27,47800000,17.00,'PMK 168 Tahun 2023'),
('A',28,51400000,18.00,'PMK 168 Tahun 2023'),
('A',29,56300000,19.00,'PMK 168 Tahun 2023'),
('A',30,62200000,20.00,'PMK 168 Tahun 2023'),
('A',31,68600000,21.00,'PMK 168 Tahun 2023'),
('A',32,77500000,22.00,'PMK 168 Tahun 2023'),
('A',33,89000000,23.00,'PMK 168 Tahun 2023'),
('A',34,103000000,24.00,'PMK 168 Tahun 2023'),
('A',35,125000000,25.00,'PMK 168 Tahun 2023'),
('A',36,157000000,26.00,'PMK 168 Tahun 2023'),
('A',37,206000000,27.00,'PMK 168 Tahun 2023'),
('A',38,337000000,28.00,'PMK 168 Tahun 2023'),
('A',39,454000000,29.00,'PMK 168 Tahun 2023'),
('A',40,550000000,30.00,'PMK 168 Tahun 2023'),
('A',41,695000000,31.00,'PMK 168 Tahun 2023'),
('A',42,910000000,32.00,'PMK 168 Tahun 2023'),
('A',43,1400000000,33.00,'PMK 168 Tahun 2023'),
('A',44,null,34.00,'PMK 168 Tahun 2023'),
('B',1,6200000,0.00,'PMK 168 Tahun 2023'),
('B',2,6500000,0.25,'PMK 168 Tahun 2023'),
('B',3,6850000,0.50,'PMK 168 Tahun 2023'),
('B',4,7300000,0.75,'PMK 168 Tahun 2023'),
('B',5,9200000,1.00,'PMK 168 Tahun 2023'),
('B',6,10750000,1.50,'PMK 168 Tahun 2023'),
('B',7,11250000,2.00,'PMK 168 Tahun 2023'),
('B',8,11600000,2.50,'PMK 168 Tahun 2023'),
('B',9,12600000,3.00,'PMK 168 Tahun 2023'),
('B',10,13600000,4.00,'PMK 168 Tahun 2023'),
('B',11,14950000,5.00,'PMK 168 Tahun 2023'),
('B',12,16400000,6.00,'PMK 168 Tahun 2023'),
('B',13,18450000,7.00,'PMK 168 Tahun 2023'),
('B',14,21850000,8.00,'PMK 168 Tahun 2023'),
('B',15,26000000,9.00,'PMK 168 Tahun 2023'),
('B',16,27700000,10.00,'PMK 168 Tahun 2023'),
('B',17,29350000,11.00,'PMK 168 Tahun 2023'),
('B',18,31450000,12.00,'PMK 168 Tahun 2023'),
('B',19,33950000,13.00,'PMK 168 Tahun 2023'),
('B',20,37100000,14.00,'PMK 168 Tahun 2023'),
('B',21,41100000,15.00,'PMK 168 Tahun 2023'),
('B',22,45800000,16.00,'PMK 168 Tahun 2023'),
('B',23,49500000,17.00,'PMK 168 Tahun 2023'),
('B',24,53800000,18.00,'PMK 168 Tahun 2023'),
('B',25,58500000,19.00,'PMK 168 Tahun 2023'),
('B',26,64000000,20.00,'PMK 168 Tahun 2023'),
('B',27,71000000,21.00,'PMK 168 Tahun 2023'),
('B',28,80000000,22.00,'PMK 168 Tahun 2023'),
('B',29,93000000,23.00,'PMK 168 Tahun 2023'),
('B',30,109000000,24.00,'PMK 168 Tahun 2023'),
('B',31,129000000,25.00,'PMK 168 Tahun 2023'),
('B',32,163000000,26.00,'PMK 168 Tahun 2023'),
('B',33,211000000,27.00,'PMK 168 Tahun 2023'),
('B',34,374000000,28.00,'PMK 168 Tahun 2023'),
('B',35,459000000,29.00,'PMK 168 Tahun 2023'),
('B',36,555000000,30.00,'PMK 168 Tahun 2023'),
('B',37,704000000,31.00,'PMK 168 Tahun 2023'),
('B',38,957000000,32.00,'PMK 168 Tahun 2023'),
('B',39,1405000000,33.00,'PMK 168 Tahun 2023'),
('B',40,null,34.00,'PMK 168 Tahun 2023'),
('C',1,6600000,0.00,'PMK 168 Tahun 2023'),
('C',2,6950000,0.25,'PMK 168 Tahun 2023'),
('C',3,7350000,0.50,'PMK 168 Tahun 2023'),
('C',4,7800000,0.75,'PMK 168 Tahun 2023'),
('C',5,8850000,1.00,'PMK 168 Tahun 2023'),
('C',6,9800000,1.25,'PMK 168 Tahun 2023'),
('C',7,10950000,1.50,'PMK 168 Tahun 2023'),
('C',8,11200000,1.75,'PMK 168 Tahun 2023'),
('C',9,12050000,2.00,'PMK 168 Tahun 2023'),
('C',10,12950000,3.00,'PMK 168 Tahun 2023'),
('C',11,14150000,4.00,'PMK 168 Tahun 2023'),
('C',12,15550000,5.00,'PMK 168 Tahun 2023'),
('C',13,17050000,6.00,'PMK 168 Tahun 2023'),
('C',14,19500000,7.00,'PMK 168 Tahun 2023'),
('C',15,22700000,8.00,'PMK 168 Tahun 2023'),
('C',16,26600000,9.00,'PMK 168 Tahun 2023'),
('C',17,28100000,10.00,'PMK 168 Tahun 2023'),
('C',18,30100000,11.00,'PMK 168 Tahun 2023'),
('C',19,32600000,12.00,'PMK 168 Tahun 2023'),
('C',20,35400000,13.00,'PMK 168 Tahun 2023'),
('C',21,38900000,14.00,'PMK 168 Tahun 2023'),
('C',22,43000000,15.00,'PMK 168 Tahun 2023'),
('C',23,47400000,16.00,'PMK 168 Tahun 2023'),
('C',24,51200000,17.00,'PMK 168 Tahun 2023'),
('C',25,55800000,18.00,'PMK 168 Tahun 2023'),
('C',26,60400000,19.00,'PMK 168 Tahun 2023'),
('C',27,66700000,20.00,'PMK 168 Tahun 2023'),
('C',28,74500000,21.00,'PMK 168 Tahun 2023'),
('C',29,83200000,22.00,'PMK 168 Tahun 2023'),
('C',30,95600000,23.00,'PMK 168 Tahun 2023'),
('C',31,110000000,24.00,'PMK 168 Tahun 2023'),
('C',32,134000000,25.00,'PMK 168 Tahun 2023'),
('C',33,169000000,26.00,'PMK 168 Tahun 2023'),
('C',34,221000000,27.00,'PMK 168 Tahun 2023'),
('C',35,390000000,28.00,'PMK 168 Tahun 2023'),
('C',36,463000000,29.00,'PMK 168 Tahun 2023'),
('C',37,561000000,30.00,'PMK 168 Tahun 2023'),
('C',38,709000000,31.00,'PMK 168 Tahun 2023'),
('C',39,965000000,32.00,'PMK 168 Tahun 2023'),
('C',40,1419000000,33.00,'PMK 168 Tahun 2023'),
('C',41,null,34.00,'PMK 168 Tahun 2023')
on conflict (category, layer_no) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Run payroll
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null
    check (period_month = date_trunc('month', period_month)::date),
  status text not null default 'Draft'
    check (status in ('Draft', 'Final', 'Dibayar', 'Direvisi')),
  revision_of uuid references public.payroll_runs (id),
  revision_reason text
    check (revision_reason is null or length(revision_reason) <= 1000),
  notes text
    check (notes is null or length(notes) <= 1000),
  employee_count integer not null default 0,
  gross_total numeric(16,2) not null default 0,
  deduction_total numeric(16,2) not null default 0,
  take_home_total numeric(16,2) not null default 0,
  employer_cost_total numeric(16,2) not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  calculated_at timestamptz,
  finalized_at timestamptz,
  finalized_by uuid,
  paid_at timestamptz,
  paid_by uuid,
  paid_date date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payroll_runs_active_period_idx
  on public.payroll_runs (period_month)
  where status in ('Draft', 'Final', 'Dibayar');

create index if not exists payroll_runs_period_idx
  on public.payroll_runs (period_month desc, created_at desc);

drop trigger if exists payroll_runs_set_updated_at on public.payroll_runs;
create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_run_employees (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id text not null,
  calc_status text not null
    check (calc_status in (
      'Lengkap', 'Profil payroll belum ada', 'Gaji pokok kosong',
      'PTKP kosong', 'Tidak memenuhi periode'
    )),
  employee_name text not null,
  department text not null,
  position text not null,
  employee_status text not null,
  base_salary numeric(14,2) not null default 0,
  fixed_allowance numeric(14,2) not null default 0,
  variable_allowance numeric(14,2) not null default 0,
  workdays integer not null default 0,
  alfa_days integer not null default 0,
  late_count integer not null default 0,
  late_minutes integer not null default 0,
  overtime_equivalent_minutes integer not null default 0,
  proration_factor numeric(6,4) not null default 1,
  gross_income numeric(16,2) not null default 0,
  overtime_pay numeric(16,2) not null default 0,
  manual_income_total numeric(16,2) not null default 0,
  manual_deduction_total numeric(16,2) not null default 0,
  bpjs_kesehatan_employee numeric(16,2) not null default 0,
  bpjs_kesehatan_employer numeric(16,2) not null default 0,
  jht_employee numeric(16,2) not null default 0,
  jht_employer numeric(16,2) not null default 0,
  jp_employee numeric(16,2) not null default 0,
  jp_employer numeric(16,2) not null default 0,
  jkk_employer numeric(16,2) not null default 0,
  jkm_employer numeric(16,2) not null default 0,
  tax_gross numeric(16,2) not null default 0,
  pph21 numeric(16,2) not null default 0,
  pph_method text not null default 'TER',
  ter_category text,
  ter_rate numeric(6,4),
  alfa_deduction numeric(16,2) not null default 0,
  late_deduction numeric(16,2) not null default 0,
  total_deductions numeric(16,2) not null default 0,
  take_home_pay numeric(16,2) not null default 0,
  employer_cost numeric(16,2) not null default 0,
  calculation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, employee_id)
);

create index if not exists payroll_run_employees_employee_idx
  on public.payroll_run_employees (employee_id, run_id);

drop trigger if exists payroll_run_employees_set_updated_at
  on public.payroll_run_employees;
create trigger payroll_run_employees_set_updated_at
  before update on public.payroll_run_employees
  for each row execute function public.set_updated_at();

create table if not exists public.payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  run_employee_id uuid not null
    references public.payroll_run_employees (id) on delete cascade,
  category text not null
    check (category in ('Pendapatan', 'Potongan')),
  label text not null
    check (length(btrim(label)) between 1 and 150),
  amount numeric(14,2) not null check (amount > 0),
  reason text not null
    check (length(btrim(reason)) between 1 and 500),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists payroll_run_items_employee_idx
  on public.payroll_run_items (run_employee_id, created_at);

create table if not exists public.payroll_run_history (
  id bigserial primary key,
  run_id uuid not null,
  action text not null
    check (action in (
      'Dibuat', 'Dihitung Ulang', 'Difinalisasi', 'Dibayar',
      'Direvisi', 'Item Ditambahkan', 'Item Dihapus'
    )),
  from_status text,
  to_status text,
  reason text
    check (reason is null or length(reason) <= 1000),
  actor_id uuid,
  acted_at timestamptz not null default now()
);

create index if not exists payroll_run_history_run_idx
  on public.payroll_run_history (run_id, acted_at desc);

-- ---------------------------------------------------------------------------
-- 5. RLS dan hak tabel
-- ---------------------------------------------------------------------------
alter table public.payroll_profiles enable row level security;
alter table public.payroll_profile_history enable row level security;
alter table public.payroll_settings enable row level security;
alter table public.payroll_settings_history enable row level security;
alter table public.payroll_ter_rates enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_run_employees enable row level security;
alter table public.payroll_run_items enable row level security;
alter table public.payroll_run_history enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'payroll_profiles', 'payroll_profile_history',
    'payroll_settings', 'payroll_settings_history', 'payroll_ter_rates',
    'payroll_runs', 'payroll_run_employees', 'payroll_run_items',
    'payroll_run_history'
  ] loop
    execute format(
      'drop policy if exists %I_staff_read on public.%I',
      v_table, v_table
    );
    execute format(
      'create policy %I_staff_read on public.%I for select to authenticated using (public.current_has_role(array[''hr_manager'']))',
      v_table, v_table
    );
    execute format(
      'revoke all on table public.%I from anon, public, authenticated',
      v_table
    );
    execute format(
      'grant select on table public.%I to authenticated',
      v_table
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to service_role',
      v_table
    );
  end loop;
end;
$$;

revoke all on sequence public.payroll_profile_history_id_seq
  from anon, public, authenticated;
revoke all on sequence public.payroll_settings_history_id_seq
  from anon, public, authenticated;
revoke all on sequence public.payroll_run_history_id_seq
  from anon, public, authenticated;
grant usage, select on sequence public.payroll_profile_history_id_seq
  to service_role;
grant usage, select on sequence public.payroll_settings_history_id_seq
  to service_role;
grant usage, select on sequence public.payroll_run_history_id_seq
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. RPC profil payroll
-- ---------------------------------------------------------------------------
create or replace function public.save_payroll_profile(
  p_employee_id text,
  p_profile jsonb,
  p_reason text
)
returns public.payroll_profiles
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_reason text;
  v_old public.payroll_profiles;
  v_new public.payroll_profiles;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengubah profil gaji'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan perubahan profil gaji wajib diisi'
      using errcode = 'P0001';
  end if;

  if p_employee_id is null or not exists (
    select 1 from public.employees where id = p_employee_id
  ) then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;

  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'Data profil gaji tidak valid' using errcode = 'P0001';
  end if;

  select * into v_old
  from public.payroll_profiles
  where employee_id = p_employee_id
  for update;

  insert into public.payroll_profiles (
    employee_id, base_salary, fixed_allowance, variable_allowance,
    ptkp_status, npwp, bpjs_kesehatan_number, bpjs_ketenagakerjaan_number,
    bank_name, bank_account_number, bank_account_holder,
    jkk_risk_class, effective_date, notes, updated_by
  ) values (
    p_employee_id,
    coalesce((p_profile->>'baseSalary')::numeric, 0),
    coalesce((p_profile->>'fixedAllowance')::numeric, 0),
    coalesce((p_profile->>'variableAllowance')::numeric, 0),
    nullif(btrim(p_profile->>'ptkpStatus'), ''),
    nullif(btrim(p_profile->>'npwp'), ''),
    nullif(btrim(p_profile->>'bpjsKesehatanNumber'), ''),
    nullif(btrim(p_profile->>'bpjsKetenagakerjaanNumber'), ''),
    nullif(btrim(p_profile->>'bankName'), ''),
    nullif(btrim(p_profile->>'bankAccountNumber'), ''),
    nullif(btrim(p_profile->>'bankAccountHolder'), ''),
    coalesce(nullif(btrim(p_profile->>'jkkRiskClass'), ''), 'very_low'),
    coalesce((p_profile->>'effectiveDate')::date, current_date),
    nullif(btrim(p_profile->>'notes'), ''),
    auth.uid()
  )
  on conflict (employee_id) do update
  set base_salary = excluded.base_salary,
      fixed_allowance = excluded.fixed_allowance,
      variable_allowance = excluded.variable_allowance,
      ptkp_status = excluded.ptkp_status,
      npwp = excluded.npwp,
      bpjs_kesehatan_number = excluded.bpjs_kesehatan_number,
      bpjs_ketenagakerjaan_number = excluded.bpjs_ketenagakerjaan_number,
      bank_name = excluded.bank_name,
      bank_account_number = excluded.bank_account_number,
      bank_account_holder = excluded.bank_account_holder,
      jkk_risk_class = excluded.jkk_risk_class,
      effective_date = excluded.effective_date,
      notes = excluded.notes,
      updated_by = auth.uid()
  returning * into v_new;

  insert into public.payroll_profile_history (
    employee_id, old_data, new_data, reason, changed_by
  ) values (
    p_employee_id,
    case when v_old.employee_id is null then null else to_jsonb(v_old) end,
    to_jsonb(v_new),
    v_reason,
    auth.uid()
  );

  return v_new;
end;
$$;

comment on function public.save_payroll_profile(text, jsonb, text) is
  'Simpan profil payroll sensitif + riwayat lama/baru; alasan wajib.';

-- ---------------------------------------------------------------------------
-- 7. RPC pengaturan payroll
-- ---------------------------------------------------------------------------
create or replace function public.save_payroll_settings(
  p_settings jsonb,
  p_effective_date date,
  p_reason text
)
returns public.payroll_settings
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_old public.payroll_settings;
  v_new public.payroll_settings;
  v_reason text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat mengubah pengaturan payroll'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan perubahan pengaturan payroll wajib diisi'
      using errcode = 'P0001';
  end if;
  if p_effective_date is null then
    raise exception 'Tanggal berlaku pengaturan wajib diisi'
      using errcode = 'P0001';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'Data pengaturan payroll tidak valid'
      using errcode = 'P0001';
  end if;

  select * into v_old
  from public.payroll_settings
  where id = true
  for update;

  insert into public.payroll_settings (
    id, settings, effective_date, updated_by
  ) values (
    true, p_settings, p_effective_date, auth.uid()
  )
  on conflict (id) do update
  set settings = excluded.settings,
      effective_date = excluded.effective_date,
      updated_by = auth.uid()
  returning * into v_new;

  insert into public.payroll_settings_history (
    old_settings, new_settings, effective_date, reason, changed_by
  ) values (
    case when v_old.id is null then null else v_old.settings end,
    v_new.settings,
    p_effective_date,
    v_reason,
    auth.uid()
  );

  return v_new;
end;
$$;

comment on function public.save_payroll_settings(jsonb, date, text) is
  'Ubah seluruh tarif/batas payroll dengan tanggal berlaku dan riwayat.';

-- ---------------------------------------------------------------------------
-- 8. RPC siklus run
-- ---------------------------------------------------------------------------
create or replace function public.create_payroll_run(p_period_month date)
returns public.payroll_runs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_period date;
  v_run public.payroll_runs;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat membuat payroll run'
      using errcode = '42501';
  end if;

  if p_period_month is null then
    raise exception 'Periode payroll wajib diisi' using errcode = 'P0001';
  end if;
  v_period := date_trunc('month', p_period_month::timestamp)::date;

  if exists (
    select 1 from public.payroll_runs
    where period_month = v_period
      and status in ('Draft', 'Final', 'Dibayar')
  ) then
    raise exception 'Periode ini sudah memiliki payroll run aktif'
      using errcode = 'P0001';
  end if;

  insert into public.payroll_runs (period_month, status, created_by)
  values (v_period, 'Draft', auth.uid())
  returning * into v_run;

  insert into public.payroll_run_history (
    run_id, action, from_status, to_status, actor_id
  ) values (v_run.id, 'Dibuat', null, 'Draft', auth.uid());

  return v_run;
end;
$$;

create or replace function public.save_payroll_run_calculation(
  p_run_id uuid,
  p_rows jsonb,
  p_totals jsonb
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_run public.payroll_runs;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menghitung payroll'
      using errcode = '42501';
  end if;

  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_run.status <> 'Draft' then
    raise exception 'Hanya payroll run Draft yang dapat dihitung ulang'
      using errcode = 'P0001';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Data perhitungan payroll tidak valid' using errcode = 'P0001';
  end if;

  delete from public.payroll_run_employees e
  where e.run_id = p_run_id
    and not exists (
      select 1 from jsonb_array_elements(p_rows) r
      where r->>'employeeId' = e.employee_id
    );

  insert into public.payroll_run_employees (
    run_id, employee_id, calc_status, employee_name, department, position,
    employee_status, base_salary, fixed_allowance, variable_allowance,
    workdays, alfa_days, late_count, late_minutes,
    overtime_equivalent_minutes, proration_factor,
    gross_income, overtime_pay, manual_income_total, manual_deduction_total,
    bpjs_kesehatan_employee, bpjs_kesehatan_employer,
    jht_employee, jht_employer, jp_employee, jp_employer,
    jkk_employer, jkm_employer, tax_gross, pph21,
    pph_method, ter_category, ter_rate, alfa_deduction, late_deduction,
    total_deductions, take_home_pay, employer_cost, calculation
  )
  select
    p_run_id, x.employee_id, x.calc_status, x.employee_name, x.department,
    x.position, x.employee_status, x.base_salary, x.fixed_allowance,
    x.variable_allowance, x.workdays, x.alfa_days, x.late_count,
    x.late_minutes, x.overtime_equivalent_minutes, x.proration_factor,
    x.gross_income, x.overtime_pay, x.manual_income_total,
    x.manual_deduction_total, x.bpjs_kesehatan_employee,
    x.bpjs_kesehatan_employer, x.jht_employee, x.jht_employer,
    x.jp_employee, x.jp_employer, x.jkk_employer, x.jkm_employer,
    x.tax_gross, x.pph21, x.pph_method, x.ter_category, x.ter_rate,
    x.alfa_deduction, x.late_deduction, x.total_deductions,
    x.take_home_pay, x.employer_cost, coalesce(x.calculation, '{}'::jsonb)
  from jsonb_to_recordset(p_rows) as x(
    employee_id text, calc_status text, employee_name text, department text,
    position text, employee_status text, base_salary numeric,
    fixed_allowance numeric, variable_allowance numeric, workdays integer,
    alfa_days integer, late_count integer, late_minutes integer,
    overtime_equivalent_minutes integer, proration_factor numeric,
    gross_income numeric, overtime_pay numeric, manual_income_total numeric,
    manual_deduction_total numeric, bpjs_kesehatan_employee numeric,
    bpjs_kesehatan_employer numeric, jht_employee numeric, jht_employer numeric,
    jp_employee numeric, jp_employer numeric, jkk_employer numeric,
    jkm_employer numeric, tax_gross numeric, pph21 numeric, pph_method text,
    ter_category text, ter_rate numeric, alfa_deduction numeric,
    late_deduction numeric, total_deductions numeric, take_home_pay numeric,
    employer_cost numeric, calculation jsonb
  )
  on conflict (run_id, employee_id) do update
  set calc_status = excluded.calc_status,
      employee_name = excluded.employee_name,
      department = excluded.department,
      position = excluded.position,
      employee_status = excluded.employee_status,
      base_salary = excluded.base_salary,
      fixed_allowance = excluded.fixed_allowance,
      variable_allowance = excluded.variable_allowance,
      workdays = excluded.workdays,
      alfa_days = excluded.alfa_days,
      late_count = excluded.late_count,
      late_minutes = excluded.late_minutes,
      overtime_equivalent_minutes = excluded.overtime_equivalent_minutes,
      proration_factor = excluded.proration_factor,
      gross_income = excluded.gross_income,
      overtime_pay = excluded.overtime_pay,
      manual_income_total = excluded.manual_income_total,
      manual_deduction_total = excluded.manual_deduction_total,
      bpjs_kesehatan_employee = excluded.bpjs_kesehatan_employee,
      bpjs_kesehatan_employer = excluded.bpjs_kesehatan_employer,
      jht_employee = excluded.jht_employee,
      jht_employer = excluded.jht_employer,
      jp_employee = excluded.jp_employee,
      jp_employer = excluded.jp_employer,
      jkk_employer = excluded.jkk_employer,
      jkm_employer = excluded.jkm_employer,
      tax_gross = excluded.tax_gross,
      pph21 = excluded.pph21,
      pph_method = excluded.pph_method,
      ter_category = excluded.ter_category,
      ter_rate = excluded.ter_rate,
      alfa_deduction = excluded.alfa_deduction,
      late_deduction = excluded.late_deduction,
      total_deductions = excluded.total_deductions,
      take_home_pay = excluded.take_home_pay,
      employer_cost = excluded.employer_cost,
      calculation = excluded.calculation;

  update public.payroll_runs
  set employee_count = coalesce((p_totals->>'employeeCount')::integer, 0),
      gross_total = coalesce((p_totals->>'grossTotal')::numeric, 0),
      deduction_total = coalesce((p_totals->>'deductionTotal')::numeric, 0),
      take_home_total = coalesce((p_totals->>'takeHomeTotal')::numeric, 0),
      employer_cost_total = coalesce((p_totals->>'employerCostTotal')::numeric, 0),
      warnings = coalesce(p_totals->'warnings', '[]'::jsonb),
      calculated_at = now()
  where id = p_run_id
  returning * into v_run;

  insert into public.payroll_run_history (
    run_id, action, from_status, to_status, actor_id
  ) values (p_run_id, 'Dihitung Ulang', 'Draft', 'Draft', auth.uid());

  return v_run;
end;
$$;

create or replace function public.add_payroll_run_item(
  p_run_id uuid,
  p_employee_id text,
  p_category text,
  p_label text,
  p_amount numeric,
  p_reason text
)
returns public.payroll_run_items
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_run public.payroll_runs;
  v_employee public.payroll_run_employees;
  v_item public.payroll_run_items;
  v_reason text;
  v_label text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menambah item payroll'
      using errcode = '42501';
  end if;

  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_run.status <> 'Draft' then
    raise exception 'Item manual hanya bisa diubah pada run Draft'
      using errcode = 'P0001';
  end if;
  if p_category not in ('Pendapatan', 'Potongan') then
    raise exception 'Kategori item tidak valid' using errcode = 'P0001';
  end if;
  v_label := nullif(btrim(coalesce(p_label, '')), '');
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_label is null or v_reason is null then
    raise exception 'Label dan alasan item wajib diisi' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal item harus lebih dari 0' using errcode = 'P0001';
  end if;

  select * into v_employee
  from public.payroll_run_employees
  where run_id = p_run_id and employee_id = p_employee_id
  for update;
  if not found then
    raise exception 'Karyawan tidak ada pada payroll run ini' using errcode = 'P0002';
  end if;

  insert into public.payroll_run_items (
    run_employee_id, category, label, amount, reason, created_by
  ) values (
    v_employee.id, p_category, v_label, p_amount, v_reason, auth.uid()
  )
  returning * into v_item;

  insert into public.payroll_run_history (
    run_id, action, reason, actor_id
  ) values (
    p_run_id, 'Item Ditambahkan',
    format('%s: %s', p_employee_id, v_label), auth.uid()
  );

  return v_item;
end;
$$;

create or replace function public.delete_payroll_run_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_item public.payroll_run_items;
  v_run public.payroll_runs;
  v_run_id uuid;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menghapus item payroll'
      using errcode = '42501';
  end if;

  select * into v_item
  from public.payroll_run_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item payroll tidak ditemukan' using errcode = 'P0002';
  end if;

  select run_id into v_run_id
  from public.payroll_run_employees
  where id = v_item.run_employee_id;

  select * into v_run from public.payroll_runs where id = v_run_id for update;
  if v_run.status <> 'Draft' then
    raise exception 'Item manual hanya bisa diubah pada run Draft'
      using errcode = 'P0001';
  end if;

  delete from public.payroll_run_items where id = p_item_id;

  insert into public.payroll_run_history (
    run_id, action, reason, actor_id
  ) values (
    v_run_id, 'Item Dihapus', v_item.label, auth.uid()
  );
end;
$$;

create or replace function public.finalize_payroll_run(p_run_id uuid)
returns public.payroll_runs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_run public.payroll_runs;
  v_issue_count integer;
  v_issue_names text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat finalisasi payroll'
      using errcode = '42501';
  end if;

  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_run.status <> 'Draft' then
    raise exception 'Hanya run Draft yang dapat difinalisasi'
      using errcode = 'P0001';
  end if;

  select count(*), string_agg(employee_name, ', ' order by employee_name)
  into v_issue_count, v_issue_names
  from public.payroll_run_employees
  where run_id = p_run_id and calc_status <> 'Lengkap';

  if v_issue_count > 0 then
    raise exception 'Finalisasi ditolak: % karyawan bermasalah (%): %',
      v_issue_count, v_issue_names, 'lengkapi profil gaji/PTKP lalu hitung ulang'
      using errcode = 'P0001';
  end if;

  if v_run.employee_count = 0 or not exists (
    select 1 from public.payroll_run_employees where run_id = p_run_id
  ) then
    raise exception 'Hitung ulang run terlebih dahulu sebelum finalisasi'
      using errcode = 'P0001';
  end if;

  update public.payroll_runs
  set status = 'Final',
      finalized_at = now(),
      finalized_by = auth.uid()
  where id = p_run_id
  returning * into v_run;

  insert into public.payroll_run_history (
    run_id, action, from_status, to_status, actor_id
  ) values (p_run_id, 'Difinalisasi', 'Draft', 'Final', auth.uid());

  return v_run;
end;
$$;

create or replace function public.mark_payroll_run_paid(
  p_run_id uuid,
  p_paid_date date default null
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_run public.payroll_runs;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat menandai payroll dibayar'
      using errcode = '42501';
  end if;

  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_run.status <> 'Final' then
    raise exception 'Hanya run Final yang dapat ditandai dibayar'
      using errcode = 'P0001';
  end if;

  update public.payroll_runs
  set status = 'Dibayar',
      paid_at = now(),
      paid_by = auth.uid(),
      paid_date = coalesce(p_paid_date, (now() at time zone 'Asia/Jakarta')::date)
  where id = p_run_id
  returning * into v_run;

  insert into public.payroll_run_history (
    run_id, action, from_status, to_status, actor_id
  ) values (p_run_id, 'Dibayar', 'Final', 'Dibayar', auth.uid());

  return v_run;
end;
$$;

create or replace function public.revise_payroll_run(
  p_run_id uuid,
  p_reason text
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_old public.payroll_runs;
  v_new public.payroll_runs;
  v_reason text;
begin
  if not public.current_has_role(array['hr_manager']) then
    raise exception 'Akses ditolak: hanya HR Manager dan Admin yang dapat merevisi payroll'
      using errcode = '42501';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Alasan revisi wajib diisi' using errcode = 'P0001';
  end if;

  select * into v_old from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_old.status not in ('Final', 'Dibayar') then
    raise exception 'Hanya run Final/Dibayar yang dapat direvisi'
      using errcode = 'P0001';
  end if;

  update public.payroll_runs set status = 'Direvisi' where id = p_run_id;

  insert into public.payroll_runs (
    period_month, status, revision_of, revision_reason, notes, created_by
  ) values (
    v_old.period_month, 'Draft', v_old.id, v_reason,
    format('Revisi dari run %s', v_old.id), auth.uid()
  )
  returning * into v_new;

  insert into public.payroll_run_employees (
    run_id, employee_id, calc_status, employee_name, department, position,
    employee_status, base_salary, fixed_allowance, variable_allowance,
    workdays, alfa_days, late_count, late_minutes,
    overtime_equivalent_minutes, proration_factor,
    gross_income, overtime_pay, manual_income_total, manual_deduction_total,
    bpjs_kesehatan_employee, bpjs_kesehatan_employer,
    jht_employee, jht_employer, jp_employee, jp_employer,
    jkk_employer, jkm_employer, tax_gross, pph21,
    pph_method, ter_category, ter_rate, alfa_deduction, late_deduction,
    total_deductions, take_home_pay, employer_cost, calculation
  )
  select
    v_new.id, employee_id, calc_status, employee_name, department, position,
    employee_status, base_salary, fixed_allowance, variable_allowance,
    workdays, alfa_days, late_count, late_minutes,
    overtime_equivalent_minutes, proration_factor,
    gross_income, overtime_pay, manual_income_total, manual_deduction_total,
    bpjs_kesehatan_employee, bpjs_kesehatan_employer,
    jht_employee, jht_employer, jp_employee, jp_employer,
    jkk_employer, jkm_employer, tax_gross, pph21,
    pph_method, ter_category, ter_rate, alfa_deduction, late_deduction,
    total_deductions, take_home_pay, employer_cost, calculation
  from public.payroll_run_employees
  where run_id = v_old.id;

  insert into public.payroll_run_items (
    run_employee_id, category, label, amount, reason, created_by
  )
  select ne.id, i.category, i.label, i.amount, i.reason, i.created_by
  from public.payroll_run_items i
  join public.payroll_run_employees oe on oe.id = i.run_employee_id
  join public.payroll_run_employees ne
    on ne.run_id = v_new.id and ne.employee_id = oe.employee_id
  where oe.run_id = v_old.id;

  update public.payroll_runs
  set employee_count = v_old.employee_count,
      gross_total = v_old.gross_total,
      deduction_total = v_old.deduction_total,
      take_home_total = v_old.take_home_total,
      employer_cost_total = v_old.employer_cost_total,
      warnings = v_old.warnings,
      calculated_at = v_old.calculated_at
  where id = v_new.id
  returning * into v_new;

  insert into public.payroll_run_history (
    run_id, action, from_status, to_status, reason, actor_id
  ) values (
    v_old.id, 'Direvisi', v_old.status, 'Direvisi', v_reason, auth.uid()
  );
  insert into public.payroll_run_history (
    run_id, action, from_status, to_status, reason, actor_id
  ) values (
    v_new.id, 'Dibuat', null, 'Draft', v_reason, auth.uid()
  );

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Slip karyawan (hanya milik sendiri, Final/Dibayar)
-- ---------------------------------------------------------------------------
create or replace function public.list_my_payslips()
returns table (
  run_id uuid,
  period_month date,
  status text,
  paid_date date,
  take_home_pay numeric,
  finalized_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
begin
  if not public.current_has_role(array['employee']) then
    raise exception 'Akses ditolak: slip hanya untuk karyawan' using errcode = '42501';
  end if;

  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    return;
  end if;

  return query
  select r.id, r.period_month, r.status, r.paid_date,
         e.take_home_pay, r.finalized_at
  from public.payroll_runs r
  join public.payroll_run_employees e on e.run_id = r.id
  where e.employee_id = v_employee_id
    and r.status in ('Final', 'Dibayar')
  order by r.period_month desc;
end;
$$;

create or replace function public.get_my_payslip(p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_employee_id text;
  v_result jsonb;
begin
  if not public.current_has_role(array['employee']) then
    raise exception 'Akses ditolak: slip hanya untuk karyawan' using errcode = '42501';
  end if;

  v_employee_id := public.current_employee_id();
  if v_employee_id is null then
    raise exception 'Akun belum tertaut ke data karyawan' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'runId', r.id,
    'periodMonth', r.period_month,
    'status', r.status,
    'paidDate', r.paid_date,
    'finalizedAt', r.finalized_at,
    'employee', jsonb_build_object(
      'id', e.employee_id,
      'name', e.employee_name,
      'department', e.department,
      'position', e.position
    ),
    'calculation', e.calculation
  )
  into v_result
  from public.payroll_runs r
  join public.payroll_run_employees e on e.run_id = r.id
  where r.id = p_run_id
    and e.employee_id = v_employee_id
    and r.status in ('Final', 'Dibayar');

  if v_result is null then
    raise exception 'Slip tidak ditemukan' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. EXECUTE fungsi
-- ---------------------------------------------------------------------------
revoke all on function public.save_payroll_profile(text, jsonb, text)
  from public, anon;
revoke all on function public.save_payroll_settings(jsonb, date, text)
  from public, anon;
revoke all on function public.create_payroll_run(date) from public, anon;
revoke all on function public.save_payroll_run_calculation(uuid, jsonb, jsonb)
  from public, anon;
revoke all on function public.add_payroll_run_item(uuid, text, text, text, numeric, text)
  from public, anon;
revoke all on function public.delete_payroll_run_item(uuid) from public, anon;
revoke all on function public.finalize_payroll_run(uuid) from public, anon;
revoke all on function public.mark_payroll_run_paid(uuid, date) from public, anon;
revoke all on function public.revise_payroll_run(uuid, text) from public, anon;
revoke all on function public.list_my_payslips() from public, anon;
revoke all on function public.get_my_payslip(uuid) from public, anon;

grant execute on function public.save_payroll_profile(text, jsonb, text)
  to authenticated, service_role;
grant execute on function public.save_payroll_settings(jsonb, date, text)
  to authenticated, service_role;
grant execute on function public.create_payroll_run(date)
  to authenticated, service_role;
grant execute on function public.save_payroll_run_calculation(uuid, jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.add_payroll_run_item(uuid, text, text, text, numeric, text)
  to authenticated, service_role;
grant execute on function public.delete_payroll_run_item(uuid)
  to authenticated, service_role;
grant execute on function public.finalize_payroll_run(uuid)
  to authenticated, service_role;
grant execute on function public.mark_payroll_run_paid(uuid, date)
  to authenticated, service_role;
grant execute on function public.revise_payroll_run(uuid, text)
  to authenticated, service_role;
grant execute on function public.list_my_payslips()
  to authenticated, service_role;
grant execute on function public.get_my_payslip(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Demo profil + run Draft November 2026
-- ---------------------------------------------------------------------------
insert into public.payroll_profiles (
  employee_id, base_salary, fixed_allowance, variable_allowance,
  ptkp_status, npwp, bpjs_kesehatan_number, bpjs_ketenagakerjaan_number,
  bank_name, bank_account_number, bank_account_holder,
  jkk_risk_class, effective_date, notes
)
select
  e.id,
  (4500000 + (e.r - 1) * 550000)::numeric,
  (500000 + mod(e.r, 3) * 250000)::numeric,
  (case when mod(e.r, 4) = 0 then 300000 else 0 end)::numeric,
  (array['TK/0','TK/1','K/0','TK/2','K/1','K/2','K/3','TK/3'])[1 + mod(e.r - 1, 8)],
  case when mod(e.r, 3) = 0 then null
    else '00.' || lpad((100000000000 + e.r * 137)::text, 15, '0')
  end,
  '000' || lpad((1000000 + e.r)::text, 9, '0'),
  '000' || lpad((2000000 + e.r)::text, 9, '0'),
  (array['BCA','Mandiri','BNI','BRI'])[1 + mod(e.r - 1, 4)],
  lpad((1234567800 + e.r)::text, 12, '0'),
  e.full_name,
  (array['very_low','low','medium','high','very_low'])[1 + mod(e.r - 1, 5)],
  '2026-01-01',
  '[DEMO] Profil payroll contoh; angka dapat berubah.'
from (
  select id, full_name, row_number() over (order by id) as r
  from public.employees
) e
on conflict (employee_id) do nothing;

insert into public.payroll_runs (
  period_month, status, notes
)
select
  '2026-11-01'::date,
  'Draft',
  '[DEMO] Contoh payroll run November 2026. Klik Hitung Ulang untuk mengisi snapshot.'
where not exists (
  select 1 from public.payroll_runs
  where period_month = '2026-11-01'::date
    and status in ('Draft', 'Final', 'Dibayar')
);

commit;

notify pgrst, 'reload schema';
