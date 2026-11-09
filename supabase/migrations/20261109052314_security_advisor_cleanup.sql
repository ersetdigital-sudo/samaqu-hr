-- Trigger / event-trigger functions tidak perlu bisa dipanggil lewat API
revoke execute on function public.log_user_access_change() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_contract_insert() from public, anon, authenticated;
revoke execute on function public.validate_contract_update() from public, anon, authenticated;
revoke execute on function public.validate_employee_status_update() from public, anon, authenticated;
revoke execute on function public.validate_employee_employment_type() from public, anon, authenticated;

-- Kunci search_path
alter function public.employee_id_from_sequence(bigint) set search_path = pg_catalog, pg_temp;
alter function public.set_updated_at() set search_path = pg_catalog, pg_temp;
alter function public.validate_contract_insert() set search_path = pg_catalog, pg_temp;
alter function public.validate_contract_update() set search_path = pg_catalog, pg_temp;
alter function public.validate_employee_status_update() set search_path = pg_catalog, pg_temp;
alter function public.validate_employee_employment_type() set search_path = pg_catalog, pg_temp;
