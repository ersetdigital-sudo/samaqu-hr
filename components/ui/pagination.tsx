"use client";

/** Pagination tabel; dipakai Direktori Karyawan dan Kontrak & Masa Kerja. */
export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  unit,
  onChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  unit: string;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div className="text-[12px] sub">
        {total === 0
          ? `0 ${unit}`
          : `Menampilkan ${from}–${to} dari ${total} ${unit}`}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-g !py-1.5 !px-3"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          Sebelumnya
        </button>
        <span className="text-[12px] sub">
          Halaman {page} / {pageCount}
        </span>
        <button
          className="btn btn-g !py-1.5 !px-3"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}
