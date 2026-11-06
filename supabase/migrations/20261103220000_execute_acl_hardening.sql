-- =============================================================================
-- 20261103220000_execute_acl_hardening.sql
-- Pengetatan hak eksekusi fungsi & hak tulis tabel audit.
--
-- Temuan audit:
--  1. `revoke execute ... from anon` pada migration sebelumnya TIDAK cukup:
--     fungsi baru mewarisi EXECUTE ke PUBLIC (`=X/postgres`), sehingga anon
--     tetap bisa memanggil RPC. Satu-satunya penahan adalah pemeriksaan
--     `current_app_role()` di dalam fungsi (auth.uid() NULL → ditolak).
--  2. `renew_contract` hanya punya grant eksplisit untuk `service_role`;
--     aplikasi bisa memanggilnya karena warisan PUBLIC. Bila PUBLIC dicabut
--     tanpa grant eksplisit, perpanjangan kontrak akan gagal.
--  3. `anon` masih memegang hak tulis pada `user_access_history`.
--
-- Perbaikan: cabut PUBLIC, beri grant eksplisit ke `authenticated` +
-- `service_role`, dan cabut seluruh hak `anon` pada tabel HRIS/akun.
-- Pemeriksaan role di dalam fungsi TIDAK diubah (tetap dipertahankan).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. EXECUTE: cabut warisan PUBLIC, beri grant eksplisit
-- ---------------------------------------------------------------------------
revoke all on function public.reactivate_employee(text, text) from public;
revoke all on function public.sync_employee_employment_type(text, text, text, uuid, text) from public;
revoke all on function public.renew_contract(uuid, date, date, text, text) from public;
revoke all on function public.employee_id_preview() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_has_role(text[]) from public;
revoke all on function public.current_employee_id() from public;

grant execute on function public.reactivate_employee(text, text)
  to authenticated, service_role;
grant execute on function public.sync_employee_employment_type(text, text, text, uuid, text)
  to authenticated, service_role;
grant execute on function public.renew_contract(uuid, date, date, text, text)
  to authenticated, service_role;
grant execute on function public.employee_id_preview()
  to authenticated, service_role;
grant execute on function public.current_app_role()
  to authenticated, service_role;
grant execute on function public.current_has_role(text[])
  to authenticated, service_role;
grant execute on function public.current_employee_id()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. anon tidak boleh menyentuh tabel HRIS / akun sama sekali
--    (sesi pengguna memakai role `authenticated`; RLS tetap penyaring baris)
-- ---------------------------------------------------------------------------
revoke all on public.roles from anon;
revoke all on public.user_profiles from anon;
revoke all on public.user_roles from anon;
revoke all on public.user_access_history from anon;
revoke all on public.employees from anon;
revoke all on public.contracts from anon;
revoke all on public.contract_history from anon;
revoke all on public.employee_status_history from anon;

commit;

notify pgrst, 'reload schema';
