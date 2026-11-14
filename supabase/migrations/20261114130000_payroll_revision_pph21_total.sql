-- ---------------------------------------------------------------------------
-- Perbaikan revisi payroll: salin total PPh 21 ke run turunan.
--
-- Run Draft hasil revisi menyalin snapshot karyawan dan total run. Kolom
-- pph21_total belum ikut tersalin sehingga run revisi tampil 0. Fungsi ini
-- mengganti versi lama dengan penyalinan pph21_total; logika lain tidak berubah.
-- ---------------------------------------------------------------------------

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
      pph21_total = v_old.pph21_total,
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

comment on function public.revise_payroll_run(uuid, text) is
  'Buat run revisi Draft dan salin snapshot, item manual, serta seluruh total termasuk PPh 21.';

revoke all on function public.revise_payroll_run(uuid, text)
  from public, anon;

grant execute on function public.revise_payroll_run(uuid, text)
  to authenticated, service_role;
