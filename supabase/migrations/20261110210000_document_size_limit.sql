-- Samakan batas unggah bucket dokumen dengan batas aplikasi: 4 MB.
-- Mime type tetap PDF, JPG, dan PNG; tidak ada perubahan lain.
update storage.buckets
set file_size_limit = 4194304
where id = 'employee-documents';
