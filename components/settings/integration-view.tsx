import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { formatDateTimeID } from "@/lib/datetime";
import type { IntegrationStatus } from "@/lib/settings/integrations";

export function IntegrationView({ status }: { status: IntegrationStatus }) {
  return (
    <>
      <PageHead
        title="Integrasi"
        subtitle="Status konfigurasi server dan layanan eksternal. Halaman ini baca-saja."
      >
        <Link className="btn btn-g" href="/settings/umum">
          Kembali
        </Link>
      </PageHead>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-5">
          <div className="font-bold text-[14px] mb-1">Email Pengirim</div>
          <div className="text-[13px] font-semibold mt-3">
            {status.senderEmail}
          </div>
          <div className="text-[11px] sub mt-2">
            Diatur di dashboard Supabase.
          </div>
        </section>

        <section className="card p-5">
          <div className="font-bold text-[14px] mb-1">
            Tugas Hapus CV Harian
          </div>
          <div className="flex flex-col gap-2 mt-3 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <span className="sub">Jadwal</span>
              <b>{status.cvSchedule}</b>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="sub">CV terakhir dihapus</span>
              <b>
                {status.lastCvDeletedAt
                  ? formatDateTimeID(status.lastCvDeletedAt)
                  : "Belum pernah berjalan"}
              </b>
            </div>
          </div>
          <div className="text-[11px] sub mt-3">
            Retensi CV mengikuti fungsi cron yang sudah berjalan.
          </div>
        </section>

        <section className="card p-5">
          <div className="font-bold text-[14px] mb-1">Konfigurasi Server</div>
          <div className="text-[11px] sub mb-3">
            Hanya status terisi/kosong. Nilai konfigurasi tidak pernah
            ditampilkan.
          </div>
          <div className="flex flex-col gap-2">
            {status.env.map((item) => (
              <div
                className="flex items-center justify-between gap-3 text-[12px]"
                key={item.key}
              >
                <span>{item.label}</span>
                <span className={`tag ${item.configured ? "t-ok" : "t-bad"}`}>
                  {item.configured ? "Terisi" : "Kosong"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="font-bold text-[14px] mb-1">Samaqu Academy</div>
          <div className="text-[12px] sub mt-3 break-all">
            {status.academyUrl}
          </div>
          <a
            className="btn btn-g mt-4"
            href={status.academyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Buka Samaqu Academy
          </a>
        </section>
      </div>
    </>
  );
}
