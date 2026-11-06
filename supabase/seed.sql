-- =============================================================================
-- seed.sql — data awal Employee Management untuk demo/QA.
-- Jalankan sekali pada database kosong. Idempotent lewat ON CONFLICT.
-- Tanggal dibuat relatif terhadap CURRENT_DATE agar selalu relevan.
--
-- Catatan: tanggal berakhir kontrak TIDAK ada di sini lagi. Sejak migration
-- 20261103120000_contracts.sql, sumbernya tabel public.contracts.
-- =============================================================================

insert into public.employees (
  id, full_name, position, department, location, manager_id, joined_at,
  employment_type, status, gender, birth_place, birth_date, address, nik,
  personal_email, work_email, phone, emergency_name, emergency_relation,
  emergency_phone, probation_start, probation_end
) values
('SQ-EMP-0001', 'Ardo Prasetya', 'HR Manager', 'People & Culture', 'Bandung (On-site)', null, current_date - 720, 'Tetap', 'Aktif', 'Laki-laki', 'Bandung', '1990-04-12', 'Jl. Riau No. 21, Bandung', '3273011204900001', 'ardo.prasetya@mail.com', 'ardo@samaqu.id', '0812-1100-2201', 'Rina Prasetya', 'Istri', '0812-1100-2202', null, null),
('SQ-EMP-0002', 'Sari Wulandari', 'Marketing Manager', 'Marketing', 'Jakarta (On-site)', 'SQ-EMP-0001', current_date - 540, 'Tetap', 'Aktif', 'Perempuan', 'Jakarta', '1991-08-22', 'Jl. Kemang Raya No. 8, Jakarta', '3174022208910002', 'sari.wulandari@mail.com', 'sari@samaqu.id', '0813-2200-3301', 'Bayu Wulandari', 'Suami', '0813-2200-3302', null, null),
('SQ-EMP-0003', 'Dewi Kurnia', 'Finance Manager', 'Keuangan', 'Bandung (On-site)', 'SQ-EMP-0001', current_date - 430, 'Tetap', 'Aktif', 'Perempuan', 'Cimahi', '1989-12-02', 'Jl. Cihampelas No. 77, Bandung', '3277030212890003', 'dewi.kurnia@mail.com', 'dewi@samaqu.id', '0815-3300-4401', 'Agus Kurnia', 'Ayah', '0815-3300-4402', null, null),
('SQ-EMP-0004', 'Arif Rahman', 'Engineering Manager', 'Teknologi', 'Remote', 'SQ-EMP-0001', current_date - 380, 'Tetap', 'Aktif', 'Laki-laki', 'Surabaya', '1992-02-17', 'Jl. Darmo Permai No. 14, Surabaya', '3578021702920004', 'arif.rahman@mail.com', 'arif@samaqu.id', '0817-4400-5501', 'Nadia Rahman', 'Istri', '0817-4400-5502', null, null),
('SQ-EMP-0005', 'Budi Santoso', 'Operations Manager', 'Operasional', 'Bandung (On-site)', 'SQ-EMP-0001', current_date - 350, 'Tetap', 'Aktif', 'Laki-laki', 'Semarang', '1988-06-09', 'Jl. Soekarno Hatta No. 302, Bandung', '3273080906880005', 'budi.santoso@mail.com', 'budi@samaqu.id', '0819-5500-6601', 'Sri Santoso', 'Ibu', '0819-5500-6602', null, null),
('SQ-EMP-0006', 'Rahma Fitri', 'Admin Gudang', 'Operasional', 'Bandung (On-site)', 'SQ-EMP-0005', current_date - 210, 'Kontrak', 'Aktif', 'Perempuan', 'Garut', '1996-03-30', 'Jl. Cibiru Hilir No. 5, Bandung', '3273053003960006', 'rahma.fitri@mail.com', 'rahma@samaqu.id', '0821-6600-7701', 'Hasan Fitri', 'Ayah', '0821-6600-7702', null, null),
('SQ-EMP-0007', 'Putra Aditya', 'Supervisor Produksi', 'Operasional', 'Bandung (On-site)', 'SQ-EMP-0005', current_date - 190, 'Tetap', 'Aktif', 'Laki-laki', 'Tasikmalaya', '1994-11-11', 'Jl. Cibaduyut No. 41, Bandung', '3273041111940007', 'putra.aditya@mail.com', 'putra@samaqu.id', '0822-7700-8801', 'Lina Aditya', 'Istri', '0822-7700-8802', null, null),
('SQ-EMP-0008', 'Nadia Safitri', 'Customer Service Specialist', 'Customer Service', 'Bandung (On-site)', 'SQ-EMP-0002', current_date - 150, 'Tetap', 'Aktif', 'Perempuan', 'Bandung', '1997-01-25', 'Jl. Buah Batu No. 90, Bandung', '3273062501970008', 'nadia.safitri@mail.com', 'nadia@samaqu.id', '0823-8800-9901', 'Dedi Safitri', 'Ayah', '0823-8800-9902', null, null),
('SQ-EMP-0009', 'Rizky Maulana', 'Frontend Developer', 'Teknologi', 'Remote', 'SQ-EMP-0004', current_date - 120, 'Tetap', 'Aktif', 'Laki-laki', 'Yogyakarta', '1995-07-19', 'Jl. Kaliurang Km 5, Yogyakarta', '3471071907950009', 'rizky.maulana@mail.com', 'rizky@samaqu.id', '0824-9900-1101', 'Tuti Maulana', 'Ibu', '0824-9900-1102', null, null),
('SQ-EMP-0010', 'Maya Anjani', 'Customer Service Specialist', 'Customer Service', 'Bandung (On-site)', 'SQ-EMP-0002', current_date - 24, 'Kontrak', 'Probation', 'Perempuan', 'Bogor', '1998-05-14', 'Jl. Pajajaran No. 18, Bogor', '3201051405980010', 'maya.anjani@mail.com', 'maya@samaqu.id', '0825-1100-2201', 'Slamet Anjani', 'Ayah', '0825-1100-2202', current_date - 24, current_date + 66),
('SQ-EMP-0011', 'Nanda Rizky', 'Digital Marketing Executive', 'Marketing', 'Jakarta (On-site)', 'SQ-EMP-0002', current_date - 18, 'Kontrak', 'Probation', 'Laki-laki', 'Depok', '1997-09-03', 'Jl. Margonda Raya No. 55, Depok', '3276010309970011', 'nanda.rizky@mail.com', 'nanda@samaqu.id', '0826-2200-3301', 'Yuli Rizky', 'Ibu', '0826-2200-3302', current_date - 18, current_date + 72),
('SQ-EMP-0012', 'Kirana Salsabila', 'Staff Keuangan', 'Keuangan', 'Bandung (On-site)', 'SQ-EMP-0003', current_date - 12, 'Magang', 'Probation', 'Perempuan', 'Bandung', '2002-02-28', 'Jl. Dipatiukur No. 64, Bandung', '3273102802020012', 'kirana.salsabila@mail.com', 'kirana@samaqu.id', '0827-3300-4401', 'Hendra Salsabila', 'Ayah', '0827-3300-4402', current_date - 12, current_date + 78),
('SQ-EMP-0013', 'Lukman Hakim', 'Warehouse Helper', 'Operasional', 'Bandung (On-site)', 'SQ-EMP-0005', current_date - 95, 'Harian', 'Aktif', 'Laki-laki', 'Cianjur', '1999-10-08', 'Jl. Raya Cianjur No. 12, Cianjur', '3203080810990013', 'lukman.hakim@mail.com', 'lukman@samaqu.id', '0828-4400-5501', 'Asep Hakim', 'Ayah', '0828-4400-5502', null, null),
('SQ-EMP-0014', 'Oki Ramadhan', 'Content Creator', 'Marketing', 'Remote', 'SQ-EMP-0002', current_date - 400, 'Kontrak', 'Nonaktif', 'Laki-laki', 'Medan', '1993-04-21', 'Jl. Gatot Subroto No. 9, Medan', '1271042104930014', 'oki.ramadhan@mail.com', 'oki@samaqu.id', '0829-5500-6601', 'Murni Ramadhan', 'Ibu', '0829-5500-6602', null, null)
on conflict (id) do nothing;

-- Selaraskan sequence dengan data yang baru masuk.
select setval(
  'public.employee_id_seq',
  coalesce(
    (select max(replace(id, 'SQ-EMP-', '')::bigint) from public.employees),
    1
  ),
  true
);
