-- Hardening grant tabel riwayat: authenticated hanya boleh SELECT.
-- Trigger pencatat berjalan SECURITY DEFINER, jadi tetap bisa menulis.
revoke all on public.job_application_stage_history from anon, public, authenticated;
grant select on public.job_application_stage_history to authenticated;

revoke all on public.job_application_data_history from anon, public, authenticated;
grant select on public.job_application_data_history to authenticated;

-- Riwayat lama: dipertahankan SELECT-only dan dipastikan tetap konsisten.
revoke all on public.contract_history from anon, public, authenticated;
grant select on public.contract_history to authenticated;

revoke all on public.employee_status_history from anon, public, authenticated;
grant select on public.employee_status_history to authenticated;

revoke all on public.user_access_history from anon, public, authenticated;
grant select on public.user_access_history to authenticated;

revoke all on public.account_deletion_log from anon, public, authenticated;
grant select on public.account_deletion_log to authenticated;

-- Onboarding bukan tabel riwayat dan ditulis aplikasi: DML dipertahankan,
-- hanya hak berlebih (REFERENCES/TRIGGER/TRUNCATE) yang dicabut.
revoke references, trigger, truncate on public.employee_onboardings from anon, public, authenticated;
revoke references, trigger, truncate on public.employee_onboarding_items from anon, public, authenticated;
