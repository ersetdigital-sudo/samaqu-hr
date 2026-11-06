-- =============================================================================
-- 20261104090000_history_insert_lockdown.sql
-- Tutup celah INSERT langsung pada tabel histori HRIS.
--
-- Temuan audit:
--   migration 20261103210000 memberi `grant select, insert on
--   contract_history / employee_status_history to authenticated`, plus policy
--   ..._hr_insert untuk hr_manager. Artinya pengguna login dengan role
--   hr_manager bisa menyisipkan histori palsu lewat REST API tanpa menjalankan
--   transaksi bisnis apa pun.
--
-- Perbaikan:
--   1. Fungsi trigger pencatat histori dijadikan SECURITY DEFINER dengan
--      search_path terkunci (pg_catalog, pg_temp) sehingga resolusi nama hanya
--      ke katalog sistem. Semua objek non-builtin ditulis schema-qualified
--      (public.* dan auth.uid()); isi logika TIDAK diubah.
--   2. Aktor tetap auth.uid() — diambil dari JWT pemanggil, bukan current_user,
--      bukan identitas statis, bukan service role.
--   3. EXECUTE kedua fungsi trigger dicabut dari PUBLIC/anon/authenticated
--      (trigger tidak butuh privilege EXECUTE saat dipanggil engine).
--   4. INSERT dicabut dari anon & authenticated. Hanya trigger (berjalan
--      sebagai owner) dan service_role yang bisa menulis histori.
--   5. Policy *_hr_insert dihapus karena sudah tidak relevan; policy SELECT
--      hr_manager tetap dipertahankan.
--
-- Tidak menyentuh: aturan bisnis kontrak, autentikasi, role/permission,
-- data karyawan/kontrak/histori existing, sequence, migration lama.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Trigger pencatat histori: jalankan sebagai owner, search_path terkunci
-- ---------------------------------------------------------------------------
create or replace function public.log_contract_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.contract_history (contract_id, employee_id, event, changes, note, changed_by)
    values (
      new.id,
      new.employee_id,
      'Dibuat',
      jsonb_build_object('after', to_jsonb(new) - 'updated_at' - 'created_at'),
      new.note,
      auth.uid()
    );
    return new;
  end if;

  if new.status = 'Diperpanjang' and old.status is distinct from 'Diperpanjang' then
    event_name := 'Diperpanjang';
  elsif new.status = 'Berakhir' and old.status is distinct from 'Berakhir' then
    event_name := 'Diakhiri';
  elsif (to_jsonb(new) - 'updated_at' - 'created_at')
        is distinct from (to_jsonb(old) - 'updated_at' - 'created_at') then
    event_name := 'Diubah';
  else
    return new;
  end if;

  insert into public.contract_history (contract_id, employee_id, event, changes, note, changed_by)
  values (
    new.id,
    new.employee_id,
    event_name,
    jsonb_build_object(
      'before', to_jsonb(old) - 'updated_at' - 'created_at',
      'after', to_jsonb(new) - 'updated_at' - 'created_at'
    ),
    new.note,
    auth.uid()
  );

  return new;
end;
$$;

comment on function public.log_contract_change() is
  'Audit kontrak. SECURITY DEFINER + search_path tetap; aktor selalu auth.uid() pemanggil. Tidak dieksekusi langsung oleh anon/authenticated.';

create or replace function public.log_employee_status_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_reason text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_reason := nullif(
    btrim(coalesce(current_setting('hr.status_change_reason', true), '')),
    ''
  );

  insert into public.employee_status_history (
    employee_id, action, from_status, to_status, reason, changed_by
  )
  values (
    new.id,
    case
      when old.status = 'Nonaktif' and new.status = 'Aktif' then 'Reaktivasi'
      else 'Perubahan Status'
    end,
    old.status,
    new.status,
    v_reason,
    auth.uid()
  );

  return new;
end;
$$;

comment on function public.log_employee_status_change() is
  'Audit status karyawan. SECURITY DEFINER + search_path tetap; aktor selalu auth.uid() pemanggil. Tidak dieksekusi langsung oleh anon/authenticated.';

-- ---------------------------------------------------------------------------
-- 2. EXECUTE fungsi trigger tidak diperlukan oleh siapa pun selain engine
--    (trigger dipanggil sebagai bagian dari statement, bukan via RPC).
-- ---------------------------------------------------------------------------
revoke all on function public.log_contract_change() from public;
revoke all on function public.log_contract_change() from anon, authenticated;
grant execute on function public.log_contract_change() to service_role;

revoke all on function public.log_employee_status_change() from public;
revoke all on function public.log_employee_status_change() from anon, authenticated;
grant execute on function public.log_employee_status_change() to service_role;

-- ---------------------------------------------------------------------------
-- 3. INSERT langsung dicabut total; SELECT hr_manager dipertahankan
-- ---------------------------------------------------------------------------
revoke insert on table public.contract_history from anon, authenticated;
revoke insert on table public.employee_status_history from anon, authenticated;

revoke all on table public.contract_history from anon;
revoke all on table public.employee_status_history from anon;

grant select on table public.contract_history to authenticated;
grant select on table public.employee_status_history to authenticated;

grant select, insert, update, delete on table public.contract_history to service_role;
grant select, insert, update, delete on table public.employee_status_history to service_role;

-- ---------------------------------------------------------------------------
-- 4. Policy INSERT tidak lagi punya pijakan: hapus, SELECT tetap
-- ---------------------------------------------------------------------------
drop policy if exists contract_history_hr_insert on public.contract_history;
drop policy if exists employee_status_history_hr_insert on public.employee_status_history;

-- Policy SELECT dibiarkan apa adanya (dibuat ulang hanya jika belum ada).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contract_history'
      and policyname = 'contract_history_hr_read'
  ) then
    create policy contract_history_hr_read on public.contract_history
      for select to authenticated
      using (public.current_has_role(array['hr_manager']));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_status_history'
      and policyname = 'employee_status_history_hr_read'
  ) then
    create policy employee_status_history_hr_read on public.employee_status_history
      for select to authenticated
      using (public.current_has_role(array['hr_manager']));
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
