-- Supabase memberi default grant ALL untuk objek baru di public.
-- View ini hanya untuk baca; cabut sisanya.
revoke all on public.employee_directory from authenticated, anon, public;
revoke all on public.employee_details from authenticated, anon, public;
grant select on public.employee_directory to authenticated, service_role;
grant select on public.employee_details to authenticated, service_role;

notify pgrst, 'reload schema';
