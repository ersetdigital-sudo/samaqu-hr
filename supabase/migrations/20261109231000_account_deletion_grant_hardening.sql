-- Hardening grant tabel audit: authenticated hanya boleh SELECT (RLS admin).
revoke all on public.account_deletion_log from authenticated;
grant select on public.account_deletion_log to authenticated;
