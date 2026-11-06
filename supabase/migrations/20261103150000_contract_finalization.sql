-- =============================================================================
-- 20261103150000_contract_finalization.sql
-- Finalisasi modul Kontrak & Masa Kerja.
--
-- Hanya menambah kolom/trigger/fungsi. Tidak ada data yang dihapus atau diubah
-- periodenya. Ringkasan:
--  * historical_overlap  : penanda data historis yang periodenya memang sudah
--                          tumpang tindih sebelum validasi overlap berlaku.
--                          Tidak pernah diisi untuk transaksi baru.
--  * contract_history.changed_by : aktor (Supabase Auth) yang mengubah kontrak.
--  * renew_contract      : tanggal mulai default = sehari setelah kontrak lama
--                          berakhir, wajib alasan jeda bila diubah, menolak
--                          kontrak Tetap, dan mencatat alasan jeda ke audit.
--  * Kontrak baru untuk karyawan Nonaktif ditolak di level database.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Penanda data historis yang sudah tumpang tindih
-- ---------------------------------------------------------------------------
alter table public.contracts
  add column if not exists historical_overlap boolean not null default false;

comment on column public.contracts.historical_overlap is
  'true hanya untuk data historis yang periodenya sudah tumpang tindih sebelum validasi overlap diberlakukan. Transaksi baru tidak boleh mengisinya.';

-- Menandai record yang benar-benar bertabrakan. Periode tidak diubah sama sekali.
update public.contracts c
set historical_overlap = true
where exists (
  select 1
  from public.contracts o
  where o.id <> c.id
    and o.employee_id = c.employee_id
    and daterange(o.start_date, o.end_date, '[]')
        && daterange(c.start_date, c.end_date, '[]')
);

-- ---------------------------------------------------------------------------
-- 2. Aktor audit pada contract_history
-- ---------------------------------------------------------------------------
alter table public.contract_history
  add column if not exists changed_by uuid references auth.users (id);

comment on column public.contract_history.changed_by is
  'auth.uid() saat perubahan dicatat. NULL selama autentikasi asli belum aktif — tidak pernah diisi identitas statis/palsu.';

-- Trigger audit: menambahkan changed_by tanpa mengubah bentuk changes/note lama.
create or replace function public.log_contract_change()
returns trigger
language plpgsql
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

-- ---------------------------------------------------------------------------
-- 3. Penjaga INSERT: karyawan Nonaktif & kontrak Tetap tanpa tanggal akhir
-- ---------------------------------------------------------------------------
create or replace function public.validate_contract_insert()
returns trigger
language plpgsql
as $$
declare
  employee_status text;
begin
  select status into employee_status
  from public.employees
  where id = new.employee_id;

  if employee_status = 'Nonaktif' then
    raise exception
      'Karyawan % berstatus Nonaktif. Reaktivasi karyawan lebih dulu sebelum membuat kontrak baru.',
      new.employee_id
      using errcode = 'P0001';
  end if;

  if new.employment_type = 'Tetap' and new.end_date is not null then
    raise exception
      'Kontrak Tetap tidak memakai tanggal berakhir. Gunakan mekanisme perubahan jenis hubungan kerja.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_validate_insert on public.contracts;
create trigger contracts_validate_insert
  before insert on public.contracts
  for each row execute function public.validate_contract_insert();

-- ---------------------------------------------------------------------------
-- 4. Perpanjangan: default sehari setelah kontrak lama berakhir
--
-- Aturan:
--  * Hanya kontrak Aktif non-Tetap yang bisa diperpanjang.
--  * Tanggal mulai default = end_date + 1 hari. Bila diubah, alasan jeda wajib.
--  * Periode baru harus setelah kontrak lama dan tidak menabrak kontrak Aktif
--    lain milik karyawan yang sama.
--  * Semua langkah dalam satu fungsi = satu transaksi (atomik): bila insert
--    gagal, status kontrak lama ikut di-rollback.
-- ---------------------------------------------------------------------------
drop function if exists public.renew_contract(uuid, date, date, text);

create or replace function public.renew_contract(
  p_previous_id uuid,
  p_start_date date,
  p_end_date date,
  p_note text default null,
  p_gap_reason text default null
)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  prev public.contracts;
  created public.contracts;
  -- Prefiks v_ wajib: nama variabel tidak boleh sama dengan nama kolom
  -- (start_date) karena plpgsql akan menganggap referensinya ambigu.
  v_default_start date;
  v_start date;
  v_gap_reason text;
begin
  select * into prev from public.contracts where id = p_previous_id for update;

  if not found then
    raise exception 'Kontrak sebelumnya tidak ditemukan' using errcode = 'P0002';
  end if;
  if prev.status <> 'Aktif' then
    raise exception 'Hanya kontrak Aktif yang bisa diperpanjang' using errcode = 'P0001';
  end if;
  if prev.employment_type = 'Tetap' then
    raise exception
      'Kontrak Tetap tidak bisa diperpanjang. Gunakan perubahan jenis hubungan kerja bila karyawan beralih ke kontrak berjangka.'
      using errcode = 'P0001';
  end if;
  if prev.end_date is null then
    raise exception
      'Kontrak sebelumnya belum punya tanggal berakhir sehingga perpanjangan tidak bisa dihitung'
      using errcode = 'P0001';
  end if;

  v_default_start := prev.end_date + 1;
  v_start := coalesce(p_start_date, v_default_start);
  v_gap_reason := nullif(btrim(coalesce(p_gap_reason, '')), '');

  if v_start <= prev.end_date then
    raise exception
      'Tanggal mulai perpanjangan (%) harus setelah tanggal berakhir kontrak sebelumnya (%)',
      v_start, prev.end_date
      using errcode = 'P0001';
  end if;
  if v_start <> v_default_start and v_gap_reason is null then
    raise exception
      'Tanggal mulai % berbeda dari tanggal default %. Alasan jeda kontrak wajib diisi.',
      v_start, v_default_start
      using errcode = 'P0001';
  end if;
  if p_end_date is null then
    raise exception 'Kontrak non-Tetap wajib punya tanggal berakhir' using errcode = 'P0001';
  end if;
  if p_end_date < v_start then
    raise exception 'Tanggal berakhir tidak boleh sebelum tanggal mulai' using errcode = 'P0001';
  end if;

  -- Pesan overlap yang jelas, dicek sebelum constraint EXCLUDE melempar error.
  if exists (
    select 1
    from public.contracts c
    where c.employee_id = prev.employee_id
      and c.status = 'Aktif'
      and c.id <> prev.id
      and daterange(c.start_date, c.end_date, '[]')
          && daterange(v_start, p_end_date, '[]')
  ) then
    raise exception
      'Periode perpanjangan bertumpang tindih dengan kontrak Aktif lain milik karyawan ini'
      using errcode = '23P01';
  end if;

  update public.contracts set status = 'Diperpanjang' where id = prev.id;

  insert into public.contracts (
    employee_id, start_date, end_date, employment_type, status,
    previous_contract_id, note
  )
  values (
    prev.employee_id, v_start, p_end_date, prev.employment_type, 'Aktif',
    prev.id, p_note
  )
  returning * into created;

  -- Jejak perpanjangan + alasan jeda (wajib terlihat di audit trail).
  insert into public.contract_history (
    contract_id, employee_id, event, changes, note, changed_by
  )
  values (
    created.id,
    created.employee_id,
    'Diperpanjang',
    jsonb_build_object(
      'previous_contract_id', prev.id,
      'previous_contract_number', prev.contract_number,
      'previous_end_date', prev.end_date,
      'default_start_date', v_default_start,
      'start_date', created.start_date,
      'gap_days', created.start_date - v_default_start,
      'gap_reason', v_gap_reason
    ),
    case
      when v_gap_reason is null
        then 'Perpanjangan tanpa jeda dari ' || prev.contract_number
      else 'Perpanjangan dengan jeda dari ' || prev.contract_number || ': ' || v_gap_reason
    end,
    auth.uid()
  );

  return created;
end;
$$;

comment on function public.renew_contract(uuid, date, date, text, text) is
  'Perpanjangan atomik: default mulai = end_date + 1 hari, alasan jeda wajib bila diubah, kontrak Tetap ditolak.';

revoke execute on function public.renew_contract(uuid, date, date, text, text)
  from anon, authenticated;
grant execute on function public.renew_contract(uuid, date, date, text, text)
  to service_role;

commit;

-- PostgREST perlu memuat ulang tanda tangan fungsi yang berubah.
notify pgrst, 'reload schema';
