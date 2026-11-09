-- Index untuk pencarian/listing yang dipakai halaman karyawan dan rekrutmen.
create index if not exists employees_full_name_idx
  on public.employees (full_name);

create index if not exists job_postings_created_at_idx
  on public.job_postings (created_at desc);

create index if not exists job_applications_created_at_idx
  on public.job_applications (created_at desc);
