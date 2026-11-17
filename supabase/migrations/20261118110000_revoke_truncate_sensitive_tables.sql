-- =============================================================================
-- 20261118110000_revoke_truncate_sensitive_tables.sql
-- Cabut TRUNCATE dari role aplikasi pada tabel yang tidak membutuhkannya.
-- Hak SELECT/INSERT/UPDATE/DELETE dan seluruh RLS tidak diubah.
-- =============================================================================

revoke truncate on table public.interviews from anon, authenticated;
revoke truncate on table public.interview_evaluations from anon, authenticated;
revoke truncate on table public.roles from anon, authenticated;
revoke truncate on table public.user_profiles from anon, authenticated;
revoke truncate on table public.user_roles from anon, authenticated;

notify pgrst, 'reload schema';
