"use client";

import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";

const METRICS = [
  ["Time to Hire", "18 hari"],
  ["Konversi Lamaran → Diterima", "3,2%"],
  ["Offer Acceptance", "86%"],
  ["Sumber Teratas", "JobStreet"],
];

const SOURCES: [string, number][] = [
  ["JobStreet", 62],
  ["LinkedIn", 48],
  ["Website SAMAQU", 37],
  ["Referral", 22],
  ["Glints", 17],
];

export function LaporanView() {
  const { toast } = useRecruitment();

  return (
    <>
      <PageHead
        title="Laporan"
        subtitle="Ringkasan performa rekrutmen periode Oktober 2026."
      >
        <button
          className="btn btn-g"
          onClick={() => toast("Ekspor belum tersedia")}
        >
          Ekspor PDF
        </button>
      </PageHead>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {METRICS.map((metric) => (
          <div className="card p-5" key={metric[0]}>
            <div className="text-[13px] sub">{metric[0]}</div>
            <div className="text-[26px] font-bold mt-2">{metric[1]}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="font-bold mb-4">Kandidat per Sumber</div>
        {SOURCES.map(([source, count]) => (
          <div className="flex items-center gap-4 mb-3" key={source}>
            <span className="w-36 text-[13px]">{source}</span>
            <div className="bar flex-1" style={{ height: 10 }}>
              <i style={{ width: `${(count / 62) * 100}%` }} />
            </div>
            <b className="w-8 text-right">{count}</b>
          </div>
        ))}
      </div>
    </>
  );
}
