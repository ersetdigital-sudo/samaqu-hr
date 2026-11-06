-- =============================================================================
-- 20261103230000_audit_trigger_and_fk_hardening.sql
-- Audit trail yang tidak memblokir penghapusan akun.
--
-- Temuan audit:
--  1. `log_user_access_change()` adalah SECURITY INVOKER. Saat `auth.users`
--     dihapus (GoTrue berjalan sebagai role administratif), cascade ke
--     `user_roles` memicu trigger AFTER DELETE yang mencoba INSERT ke
--     `user_access_history`. Role tersebut tidak punya hak tulis sehingga
--     seluruh penghapusan akun gagal: "Database error deleting user".
--     → fungsi dibuat SECURITY DEFINER dengan search_path terkunci.
--  2. FK `changed_by` / `created_by` memakai NO ACTION sehingga akun yang
--     punya jejak audit tidak bisa dihapus tanpa menghapus auditnya.
--     → diubah menjadi ON DELETE SET NULL: baris audit tetap ada, aktor
--       menjadi NULL bila akunnya memang dihapus.
--
-- Tidak ada data yang dihapus/diubah. Constraint hanya diganti definisinya.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Trigger audit akun berjalan sebagai pemilik fungsi
-- ---------------------------------------------------------------------------
create or replace function public.log_user_access_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_name text;
  v_reason text;
begin
  v_reason := nullif(btrim(coalesce(current_setting('hr.access_reason', true), '')), '');

  if tg_table_name = 'user_roles' then
    select name into v_role_name from public.roles where id = coalesce(new.role_id, old.role_id);

    insert into public.user_access_history (user_id, action, from_value, to_value, reason, changed_by)
    values (
      coalesce(new.user_id, old.user_id),
      case when tg_op = 'INSERT' then 'Peran Ditambahkan' else 'Peran Diubah' end,
      case when tg_op = 'DELETE' then v_role_name else null end,
      case when tg_op = 'INSERT' then v_role_name else null end,
      v_reason,
      auth.uid()
    );
    return coalesce(new, old);
  end if;

  -- user_profiles
  if tg_op = 'INSERT' then
    insert into public.user_access_history (user_id, action, from_value, to_value, changed_by)
    values (new.id, 'Akun Dibuat', null, new.account_status, auth.uid());
    return new;
  end if;

  if new.account_status is distinct from old.account_status then
    insert into public.user_access_history (user_id, action, from_value, to_value, reason, changed_by)
    values (
      new.id, 'Status Akun', old.account_status, new.account_status, v_reason, auth.uid()
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Jejak audit tetap utuh saat akun dihapus
-- ---------------------------------------------------------------------------
alter table public.contract_history
  drop constraint if exists contract_history_changed_by_fkey;
alter table public.contract_history
  add constraint contract_history_changed_by_fkey
  foreign key (changed_by) references auth.users (id) on delete set null;

alter table public.employee_status_history
  drop constraint if exists employee_status_history_changed_by_fkey;
alter table public.employee_status_history
  add constraint employee_status_history_changed_by_fkey
  foreign key (changed_by) references auth.users (id) on delete set null;

alter table public.user_roles
  drop constraint if exists user_roles_created_by_fkey;
alter table public.user_roles
  add constraint user_roles_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.user_access_history
  drop constraint if exists user_access_history_changed_by_fkey;
alter table public.user_access_history
  add constraint user_access_history_changed_by_fkey
  foreign key (changed_by) references auth.users (id) on delete set null;

commit;

notify pgrst, 'reload schema';
