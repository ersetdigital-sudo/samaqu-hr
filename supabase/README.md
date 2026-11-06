# Database Samaqu HRIS (Supabase)

Skema dikelola sebagai migration SQL berversi di `supabase/migrations/`.
Jangan mengubah tabel lewat dashboard tanpa menambahkan file migration —
kalau tidak, database lokal/CI dan production akan berbeda.

## Struktur

```
supabase/
  migrations/   # perubahan skema, urut berdasarkan nama file (timestamp)
  seed.sql      # data awal untuk demo/QA (idempotent)
```

## Menjalankan

Dengan Supabase CLI (disarankan untuk kerja harian):

```bash
supabase link --project-ref wyfeotgzfewccmnsbcbf
supabase db push        # terapkan migration yang belum jalan
psql "$DATABASE_URL" -f supabase/seed.sql   # opsional: data awal
```

Atau lewat SQL Editor dashboard: tempel isi migration secara berurutan.

## Aturan skema

- `public.employees.id` (`SQ-EMP-0001`) adalah identitas utama lintas modul.
  Nilainya dibuat sequence — jangan pernah diisi manual dari aplikasi.
- Modul lain menyimpan referensi ke Employee ID, bukan menyalin data karyawan.
- NIK KTP hanya boleh dibaca lewat API detail untuk role berhak; jangan
  menambahkannya ke view/daftar/ekspor.
- Semua tabel baru: aktifkan RLS. Akses saat ini hanya dari server
  (service role) sampai autentikasi asli dan policy per-role tersedia.
- `public.contracts` adalah satu-satunya sumber tanggal berakhir kontrak.
  Jangan menambahkan kolom tanggal kontrak kembali ke `employees`.
- Status kontrak yang disimpan hanya `Aktif`, `Berakhir`, `Diperpanjang`.
  `Akan Berakhir` dihitung di aplikasi dari tanggal, bukan kolom database.
- Perpanjangan selalu membuat record baru (`previous_contract_id`) dan
  dijalankan lewat `renew_contract` agar atomik. Kontrak Tetap tidak boleh
  diperpanjang; perubahan jenis hubungan kerja memakai jalur sinkronisasi
  eksplisit yang tercatat di `contract_history`.

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — hanya server>
```

`.env.local` tidak di-commit. Salin dari `.env.example`.
