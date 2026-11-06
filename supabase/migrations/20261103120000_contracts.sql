-- =============================================================================
-- 20261103120000_contracts.sql
-- Kontrak & Masa Kerja.
--
-- Keputusan penting:
--  * `contracts` menjadi SATU-SATUNYA sumber tanggal berakhir kontrak.
--    Data lama di employees.contract_end di-backfill ke sini lalu kolomnya
--    dihapus supaya tidak ada dua sumber yang bisa bentrok.
--  * Perpanjangan = record baru yang menunjuk ke kontrak sebelumnya
--    (previous_contract_id). Kontrak lama ditandai 'Diperpanjang', bukan
--    diubah diam-diam.
--  * Satu karyawan tidak boleh punya dua kontrak 'Aktif' yang periodenya
--    tumpang tindih — dijaga EXCLUDE constraint (berlaku juga untuk kontrak
--    tanpa tanggal berakhir / Tetap).
--  * Semua perubahan kontrak dicatat otomatis oleh trigger ke contract_history.
-- =============================================================================

create extension if not exists btree_gist;

create sequence if not exists public.contract_number_seq as bigint start with 1;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique
    default ('SQ-CTR-' || lpad(nextval('public.contract_number_seq')::text, 4, '0')),
  employee_id text not null,
  start_date date not null,
  end_date date,
  employment_type text not null
    check (employment_type in ('Tetap', 'Kontrak', 'Magang', 'Harian')),
  status text not null default 'Aktif'
    check (status in ('Aktif', 'Berakhir', 'Diperpanjang')),
  previous_contract_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contracts_employee_fkey
    foreign key (employee_id) references public.employees (id)
    on update cascade on delete restrict,
  constraint contracts_previous_fkey
    foreign key (previous_contract_id) references public.contracts (id)
    on delete set null,
  constraint contracts_date_order
    check (end_date is null or end_date >= start_date),
  -- Kontrak Tetap boleh tanpa tanggal berakhir; jenis lain wajib punya.
  constraint contracts_end_required
    check (employment_type = 'Tetap' or end_date is not null)
);

comment on table public.contracts is
  'Kontrak kerja per karyawan. Sumber tunggal tanggal berakhir kontrak.';
comment on column public.contracts.previous_contract_id is
  'Diisi saat perpanjangan: menunjuk kontrak yang digantikan.';

-- Larangan kontrak Aktif tumpang tindih. `daterange(start, null)` = tak
-- terbatas, sehingga kontrak Tetap tanpa akhir juga menutup periode ke depan.
alter table public.contracts
  add constraint contracts_no_overlap
  exclude using gist (
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status = 'Aktif');

create index if not exists contracts_employee_idx
  on public.contracts (employee_id, status);
create index if not exists contracts_status_idx
  on public.contracts (status);
create index if not exists contracts_end_date_idx
  on public.contracts (end_date);
create index if not exists contracts_number_trgm_idx
  on public.contracts using gin (contract_number extensions.gin_trgm_ops);

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Jejak perubahan kontrak
-- ---------------------------------------------------------------------------
create table if not exists public.contract_history (
  id bigserial primary key,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  employee_id text not null,
  event text not null
    check (event in ('Dibuat', 'Diubah', 'Diperpanjang', 'Diakhiri')),
  changes jsonb not null default '{}'::jsonb,
  note text,
  changed_at timestamptz not null default now()
);

comment on table public.contract_history is
  'Audit trail kontrak. Ditulis otomatis oleh trigger, bukan oleh aplikasi.';

create index if not exists contract_history_contract_idx
  on public.contract_history (contract_id, changed_at desc);
create index if not exists contract_history_employee_idx
  on public.contract_history (employee_id, changed_at desc);

create or replace function public.log_contract_change()
returns trigger
language plpgsql
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.contract_history (contract_id, employee_id, event, changes, note)
    values (
      new.id,
      new.employee_id,
      'Dibuat',
      jsonb_build_object('after', to_jsonb(new) - 'updated_at' - 'created_at'),
      new.note
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

  insert into public.contract_history (contract_id, employee_id, event, changes, note)
  values (
    new.id,
    new.employee_id,
    event_name,
    jsonb_build_object(
      'before', to_jsonb(old) - 'updated_at' - 'created_at',
      'after', to_jsonb(new) - 'updated_at' - 'created_at'
    ),
    new.note
  );

  return new;
end;
$$;

create trigger contracts_log_change
  after insert or update on public.contracts
  for each row execute function public.log_contract_change();

-- ---------------------------------------------------------------------------
-- Perpanjangan atomik: kontrak lama ditandai Diperpanjang, record baru dibuat.
-- Dijalankan dalam satu transaksi sehingga tidak ada kondisi setengah jadi.
-- ---------------------------------------------------------------------------
create or replace function public.renew_contract(
  p_previous_id uuid,
  p_start_date date,
  p_end_date date,
  p_note text default null
)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  prev public.contracts;
  created public.contracts;
begin
  select * into prev from public.contracts where id = p_previous_id for update;

  if not found then
    raise exception 'Kontrak sebelumnya tidak ditemukan' using errcode = 'P0002';
  end if;
  if prev.status <> 'Aktif' then
    raise exception 'Hanya kontrak Aktif yang bisa diperpanjang' using errcode = 'P0001';
  end if;
  if p_start_date < prev.start_date then
    raise exception 'Tanggal mulai perpanjangan tidak boleh sebelum kontrak sebelumnya' using errcode = 'P0001';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Tanggal berakhir tidak boleh sebelum tanggal mulai' using errcode = 'P0001';
  end if;
  if prev.employment_type <> 'Tetap' and p_end_date is null then
    raise exception 'Kontrak non-Tetap wajib punya tanggal berakhir' using errcode = 'P0001';
  end if;

  update public.contracts set status = 'Diperpanjang' where id = prev.id;

  insert into public.contracts (
    employee_id, start_date, end_date, employment_type, status,
    previous_contract_id, note
  )
  values (
    prev.employee_id, p_start_date, p_end_date, prev.employment_type, 'Aktif',
    prev.id, p_note
  )
  returning * into created;

  return created;
end;
$$;

comment on function public.renew_contract(uuid, date, date, text) is
  'Membuat kontrak perpanjangan dan menandai kontrak lama Diperpanjang (atomik).';

-- ---------------------------------------------------------------------------
-- Backfill dari Direktori, lalu hapus kolom duplikat di employees.
-- ---------------------------------------------------------------------------
insert into public.contracts (
  employee_id, start_date, end_date, employment_type, status, note
)
select
  e.id,
  e.joined_at,
  e.contract_end,
  e.employment_type,
  case
    when e.status = 'Nonaktif' then 'Berakhir'
    when e.contract_end is not null and e.contract_end < current_date then 'Berakhir'
    else 'Aktif'
  end,
  'Kontrak awal dimigrasikan dari data Direktori'
from public.employees e
where not exists (
  select 1 from public.contracts c where c.employee_id = e.id
)
order by e.id;

select setval(
  'public.contract_number_seq',
  coalesce((select count(*) from public.contracts), 1),
  true
);

alter table public.employees drop column if exists contract_end;

-- ---------------------------------------------------------------------------
-- Keamanan: RLS aktif tanpa policy, akses hanya dari server (service role).
-- ---------------------------------------------------------------------------
alter table public.contracts enable row level security;
alter table public.contract_history enable row level security;

revoke all on table public.contracts from anon, authenticated;
revoke all on table public.contract_history from anon, authenticated;
revoke all on sequence public.contract_number_seq from anon, authenticated;
revoke execute on function public.renew_contract(uuid, date, date, text)
  from anon, authenticated;

grant select, insert, update, delete on table public.contracts to service_role;
grant select, insert, update, delete on table public.contract_history to service_role;
grant usage, select on sequence public.contract_number_seq to service_role;
grant execute on function public.renew_contract(uuid, date, date, text) to service_role;
