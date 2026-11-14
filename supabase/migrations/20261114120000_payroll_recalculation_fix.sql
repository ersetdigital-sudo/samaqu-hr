-- ---------------------------------------------------------------------------
-- Perbaikan hitung ulang payroll.
--
-- Kontrak JSON untuk save_payroll_run_calculation memakai snake_case secara
-- konsisten: baris (employee_id, calc_status, ...) dan total (employee_count,
-- gross_total, ...). Sebelumnya bagian hapus memakai employeeId dan total
-- memakai employeeCount, sehingga insert membaca NULL dan gagal.
-- ---------------------------------------------------------------------------

alter table public.payroll_runs
  add column if not exists pph21_total numeric(16,2) not null default 0;

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
  if p_totals is null or jsonb_typeof(p_totals) <> 'object' then
    raise exception 'Total perhitungan payroll tidak valid' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) r
    where jsonb_typeof(r) <> 'object'
      or nullif(btrim(coalesce(r->>'employee_id', '')), '') is null
  ) then
    raise exception 'Data perhitungan payroll tidak valid: employee_id wajib diisi untuk setiap baris'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) r
    group by r->>'employee_id'
    having count(*) > 1
  ) then
    raise exception 'Data perhitungan payroll memuat karyawan ganda'
      using errcode = 'P0001';
  end if;

  delete from public.payroll_run_employees e
  where e.run_id = p_run_id
    and not exists (
      select 1 from jsonb_array_elements(p_rows) r
      where r->>'employee_id' = e.employee_id
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
  set employee_count = coalesce((p_totals->>'employee_count')::integer, 0),
      gross_total = coalesce((p_totals->>'gross_total')::numeric, 0),
      deduction_total = coalesce((p_totals->>'deduction_total')::numeric, 0),
      pph21_total = coalesce((p_totals->>'pph21_total')::numeric, 0),
      take_home_total = coalesce((p_totals->>'take_home_total')::numeric, 0),
      employer_cost_total = coalesce((p_totals->>'employer_cost_total')::numeric, 0),
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

comment on function public.save_payroll_run_calculation(uuid, jsonb, jsonb) is
  'Simpan snapshot perhitungan payroll. Baris dan total memakai kunci JSON snake_case.';

revoke all on function public.save_payroll_run_calculation(uuid, jsonb, jsonb)
  from public, anon;

grant execute on function public.save_payroll_run_calculation(uuid, jsonb, jsonb)
  to authenticated, service_role;
