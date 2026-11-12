-- =============================================================================
-- 20261110200000_employee_documents.sql
-- Modul Dokumen & Berkas (Employee Management).
--
--  * employee_documents: metadata dokumen karyawan; file fisik di bucket privat
--    `employee-documents` (PDF/JPG/PNG, maks 5 MB), path <employee_id>/<uuid>.<ext>.
--  * employee_document_history: jejak aksi (Diunggah/Diubah/Diganti/Dihapus)
--    yang hanya ditulis trigger SECURITY DEFINER, read-only untuk aplikasi.
--  * RLS: HR Manager/Admin penuh; karyawan hanya baris miliknya sendiri
--    (current_employee_id). Recruiter tidak punya akses.
--  * Bucket privat tanpa policy storage: semua akses file lewat API server.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabel dokumen
-- ---------------------------------------------------------------------------
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null
    references public.employees (id) on delete cascade,
  doc_type text not null
    check (doc_type in ('KTP', 'KK', 'Ijazah', 'Sertifikat', 'Kontrak Tertanda', 'Surat Lainnya')),
  title text
    check (title is null or (length(btrim(title)) > 0 and length(title) <= 150)),
  file_path text not null unique,
  file_name text not null check (length(btrim(file_name)) > 0),
  file_size bigint not null check (file_size > 0),
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  valid_until date,
  uploaded_by uuid default auth.uid(),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_documents_employee_idx
  on public.employee_documents (employee_id, uploaded_at desc);
create index if not exists employee_documents_valid_until_idx
  on public.employee_documents (valid_until);

comment on table public.employee_documents is
  'Metadata dokumen karyawan. File fisik hanya di bucket privat, tidak pernah diekspos ke klien.';

-- ---------------------------------------------------------------------------
-- 2. Riwayat dokumen (trigger-only)
-- ---------------------------------------------------------------------------
create table if not exists public.employee_document_history (
  id bigserial primary key,
  document_id uuid not null,
  employee_id text not null,
  doc_type text not null,
  file_name text not null,
  action text not null
    check (action in ('Diunggah', 'Diubah', 'Diganti', 'Dihapus')),
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists employee_document_history_employee_idx
  on public.employee_document_history (employee_id, changed_at desc);
create index if not exists employee_document_history_document_idx
  on public.employee_document_history (document_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 3. Trigger updated_at + pencatat riwayat
-- ---------------------------------------------------------------------------
drop trigger if exists employee_documents_set_updated_at
  on public.employee_documents;
create trigger employee_documents_set_updated_at
  before update on public.employee_documents
  for each row execute function public.set_updated_at();

create or replace function public.log_employee_document_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.employee_document_history
      (document_id, employee_id, doc_type, file_name, action, changed_by)
    values
      (new.id, new.employee_id, new.doc_type, new.file_name, 'Diunggah', auth.uid());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
      return new;
    end if;

    insert into public.employee_document_history
      (document_id, employee_id, doc_type, file_name, action, changed_by)
    values (
      new.id,
      new.employee_id,
      new.doc_type,
      new.file_name,
      case
        when new.file_path is distinct from old.file_path then 'Diganti'
        else 'Diubah'
      end,
      auth.uid()
    );
    return new;
  end if;

  insert into public.employee_document_history
    (document_id, employee_id, doc_type, file_name, action, changed_by)
  values
    (old.id, old.employee_id, old.doc_type, old.file_name, 'Dihapus', auth.uid());
  return old;
end;
$$;

comment on function public.log_employee_document_change() is
  'Audit dokumen karyawan. SECURITY DEFINER + search_path terkunci; aktor selalu auth.uid() pemanggil.';

drop trigger if exists employee_documents_log_change
  on public.employee_documents;
create trigger employee_documents_log_change
  after insert or update or delete on public.employee_documents
  for each row execute function public.log_employee_document_change();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.employee_documents enable row level security;
alter table public.employee_document_history enable row level security;

drop policy if exists employee_documents_staff_all on public.employee_documents;
create policy employee_documents_staff_all on public.employee_documents
  for all to authenticated
  using (public.current_has_role(array['hr_manager']))
  with check (public.current_has_role(array['hr_manager']));

drop policy if exists employee_documents_self_read on public.employee_documents;
create policy employee_documents_self_read on public.employee_documents
  for select to authenticated
  using (employee_id = public.current_employee_id());

drop policy if exists employee_document_history_staff_read
  on public.employee_document_history;
create policy employee_document_history_staff_read
  on public.employee_document_history
  for select to authenticated
  using (public.current_has_role(array['hr_manager']));

-- ---------------------------------------------------------------------------
-- 5. Hak tabel: aplikasi hanya DML pada dokumen, SELECT pada riwayat
-- ---------------------------------------------------------------------------
revoke all on public.employee_documents from anon, public, authenticated;
grant select, insert, update, delete on public.employee_documents to authenticated;
revoke references, trigger, truncate on public.employee_documents from authenticated;

revoke all on public.employee_document_history from anon, public, authenticated;
grant select on public.employee_document_history to authenticated;

revoke all on sequence public.employee_document_history_id_seq
  from anon, public, authenticated;

grant select, insert, update, delete on public.employee_documents to service_role;
grant select, insert, update, delete on public.employee_document_history to service_role;
grant usage, select on sequence public.employee_document_history_id_seq to service_role;

revoke all on function public.log_employee_document_change()
  from public, anon, authenticated;
grant execute on function public.log_employee_document_change() to service_role;

-- ---------------------------------------------------------------------------
-- 6. Bucket storage privat (tanpa policy = tidak bisa diakses dari browser)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

notify pgrst, 'reload schema';
