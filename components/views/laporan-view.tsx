"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { PageHead } from "@/components/page-head";
import { formatDateID } from "@/lib/datetime";
import {
  MIN_SAMPLE,
  PERIOD_OPTIONS,
  acceptanceRate,
  formatDays,
  formatPercent,
  formatScore,
  isReportPeriod,
  passRate,
  percentChange,
  sourceLabel,
  type ReportData,
  type ReportPeriod,
} from "@/lib/recruitment/reports/model";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="text-[12px] sub font-semibold">{label}</div>
      <div className="text-[26px] font-bold tracking-tight mt-2">{value}</div>
      <div className="text-[12px] mt-1">{hint}</div>
    </div>
  );
}

function Comparison({
  current,
  previous,
  hidden,
}: {
  current: number;
  previous: number | null;
  hidden?: boolean;
}) {
  if (hidden) return <span className="sub">Seluruh periode</span>;
  if (previous === null)
    return <span className="sub">Periode sebelumnya tidak tersedia</span>;

  const change = percentChange(current, previous);
  if (change === null)
    return <span className="sub">Tidak ada data pembanding</span>;
  if (change === 0)
    return <span className="sub">Sama dengan periode sebelumnya</span>;

  const up = change > 0;
  return (
    <span style={{ color: up ? "var(--ok)" : "var(--bad)" }}>
      {up ? "Naik" : "Turun"} {Math.abs(change)}% dari periode sebelumnya
    </span>
  );
}

function FunnelSection({ data }: { data: ReportData }) {
  const first = data.funnel[0]?.count ?? 0;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-bold text-[15px]">Corong per Tahap</div>
        <span className="tag t-mute">Ditolak: {data.summary.rejected}</span>
      </div>
      <p className="text-[11px] sub mb-4">
        Dihitung dari riwayat tahap; pelamar tanpa riwayat lengkap memakai tahap
        saat ini.
      </p>

      {first === 0 ? (
        <p className="sub text-[13px]">Belum ada pelamar pada periode ini.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.funnel.map((row, index) => {
            const next = data.funnel[index + 1];
            return (
              <div key={row.stage}>
                <div className="flex items-baseline justify-between gap-3 text-[12px] mb-1">
                  <span>{row.stage}</span>
                  <span>
                    <b>{row.count}</b>
                    {next ? (
                      <span className="sub">
                        {" "}
                        · {formatPercent(passRate(row.count, next.count))} lolos
                        ke {next.stage}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="bar">
                  <i
                    style={{
                      width: `${first > 0 ? (row.count / first) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SpeedSection({ speed }: { speed: ReportData["speed"] }) {
  const accepted = speed.toAccepted;

  return (
    <div className="card p-6">
      <div className="font-bold text-[15px]">Kecepatan Proses</div>
      <p className="text-[11px] sub mt-1 mb-4">
        Dihitung dari perpindahan tahap yang tercatat. Angka akurat untuk
        perpindahan setelah 10 November 2026.
      </p>

      <div className="rounded-xl p-3 mb-4" style={{ background: "#FAF7F5" }}>
        <div className="text-[11px] sub">Rata-rata melamar → Diterima</div>
        <div className="mt-1 text-[15px] font-bold">
          {accepted.sample < MIN_SAMPLE ? (
            <span className="sub font-normal text-[13px]">
              Belum cukup data ({accepted.sample} sampel)
            </span>
          ) : (
            <>
              {formatDays(accepted.avgDays)}{" "}
              <span className="sub font-normal text-[12px]">
                · {accepted.sample} sampel
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {speed.stages.map((stage) => (
          <div
            key={stage.stage}
            className="flex items-center justify-between gap-3 text-[12px] border-t pt-2"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="sub">{stage.stage}</span>
            {stage.sample < MIN_SAMPLE ? (
              <span className="sub">
                Belum cukup data ({stage.sample} sampel)
              </span>
            ) : (
              <span className="font-semibold">
                {formatDays(stage.avgDays)}{" "}
                <span className="sub font-normal">· {stage.sample} sampel</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type SortKey =
  | "title"
  | "total"
  | "inProgress"
  | "accepted"
  | "rejected"
  | "rate";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Lowongan" },
  { key: "total", label: "Pelamar" },
  { key: "inProgress", label: "Diproses" },
  { key: "accepted", label: "Diterima" },
  { key: "rejected", label: "Ditolak" },
  { key: "rate", label: "% Diterima" },
];

function PerJobSection({ rows }: { rows: ReportData["perJob"] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "total",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const value = (
      row: ReportData["perJob"][number],
      key: SortKey
    ): number | string => {
      if (key === "title") return row.title.toLowerCase();
      if (key === "rate") return acceptanceRate(row.accepted, row.total) ?? -1;
      return row[key];
    };

    return [...rows].sort((a, b) => {
      const av = value(a, sort.key);
      const bv = value(b, sort.key);
      const compared =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv), "id")
          : av - bv;
      return sort.dir === "asc" ? compared : -compared;
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-[17px]">Per Lowongan</div>
        <span className="text-[12px] sub">
          Klik judul kolom untuk mengurutkan
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="card p-6 sub text-[13px]">
          Belum ada pelamar pada periode ini.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                {SORT_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sort.key === column.key
                        ? sort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="font-bold"
                      onClick={() => toggle(column.key)}
                    >
                      {column.label}
                      {sort.key === column.key
                        ? sort.dir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.jobId}>
                  <td className="font-semibold">{row.title}</td>
                  <td>{row.total}</td>
                  <td>{row.inProgress}</td>
                  <td>{row.accepted}</td>
                  <td>{row.rejected}</td>
                  <td>
                    {formatPercent(
                      acceptanceRate(row.accepted, row.total),
                      1
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TrendSection({ points }: { points: ReportData["trend"] }) {
  const max = Math.max(1, ...points.map((point) => point.count));

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-bold text-[15px]">Tren Pelamar</div>
        <span className="text-[11px] sub">Per minggu, mulai Senin (WIB)</span>
      </div>

      {points.length === 0 ? (
        <p className="sub text-[13px] mt-3">Belum ada data.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <div className="flex items-end gap-2 min-w-max">
            {points.map((point) => (
              <div
                key={point.weekStart}
                className="flex flex-col items-center gap-1"
                style={{ width: 48 }}
              >
                <div className="text-[10px] sub">{point.count}</div>
                <div className="w-full flex items-end" style={{ height: 110 }}>
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${
                        point.count > 0
                          ? Math.max(4, (point.count / max) * 100)
                          : 0
                      }%`,
                      background: "var(--pink)",
                    }}
                  />
                </div>
                <div className="text-[9px] sub text-center leading-tight">
                  {formatDateID(point.weekStart)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourcesSection({ sources }: { sources: ReportData["sources"] }) {
  const total = sources.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...sources.map((row) => row.count));

  return (
    <div className="card p-6">
      <div className="font-bold text-[15px] mb-4">Sumber Pelamar</div>

      {total === 0 ? (
        <p className="sub text-[13px]">Belum ada pelamar pada periode ini.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((row) => (
            <div key={row.source} className="flex items-center gap-3 text-[12px]">
              <span className="w-40 shrink-0">{sourceLabel(row.source)}</span>
              <div className="bar flex-1">
                <i style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
              <span className="w-8 text-right font-semibold">{row.count}</span>
              <span className="w-14 text-right sub">
                {formatPercent(
                  total > 0 ? (row.count / total) * 100 : null,
                  1
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewsSection({ data }: { data: ReportData["interviews"] }) {
  if (data.total === 0)
    return (
      <div className="card p-6">
        <div className="font-bold text-[15px] mb-1">Wawancara</div>
        <p className="sub text-[13px]">
          Belum ada jadwal wawancara pada periode ini.
        </p>
      </div>
    );

  const stats: [string, number][] = [
    ["Total jadwal", data.total],
    ["Selesai", data.selesai],
    ["Tidak hadir", data.tidakHadir],
    ["Dibatalkan", data.dibatalkan],
  ];

  return (
    <div className="card p-6">
      <div className="font-bold text-[15px] mb-4">Wawancara</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: "#FAF7F5" }}
          >
            <div className="text-[11px] sub">{label}</div>
            <div className="text-[20px] font-bold mt-1">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]">
        <span>
          Rata-rata nilai:{" "}
          <b>
            {data.avgScore !== null
              ? `${formatScore(data.avgScore)} / 5`
              : "Belum ada evaluasi"}
          </b>
        </span>
        <span>
          Rekomendasi: Lanjut <b>{data.recommendations.lanjut}</b> ·
          Pertimbangkan <b>{data.recommendations.pertimbangkan}</b> · Tolak{" "}
          <b>{data.recommendations.tolak}</b>
        </span>
      </div>
    </div>
  );
}

export function LaporanView({
  initial,
  initialPeriod,
  initialJob,
  initialError,
}: {
  initial: ReportData | null;
  initialPeriod: ReportPeriod;
  initialJob: string;
  initialError?: string;
}) {
  const [report, setReport] = useState<ReportData | null>(initial);
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [job, setJob] = useState(initialJob);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  async function applyFilters(nextPeriod: ReportPeriod, nextJob: string) {
    setPeriod(nextPeriod);
    setJob(nextJob);
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ period: nextPeriod });
    if (nextJob !== "all") params.set("job", nextJob);
    window.history.replaceState(
      null,
      "",
      `/recruitment/laporan?${params.toString()}`
    );

    const request = ++requestId.current;
    try {
      const response = await fetch(
        `/api/recruitment/reports?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as {
        report?: ReportData;
        error?: string;
      } | null;
      if (!response.ok || !data?.report)
        throw new Error(data?.error ?? "Laporan belum dapat dimuat");
      if (request === requestId.current) setReport(data.report);
    } catch (cause) {
      if (request === requestId.current) {
        setReport(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "Laporan belum dapat dimuat"
        );
      }
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  const exportUrl = (dataset: "jobs" | "applicants") => {
    const params = new URLSearchParams({ dataset, period });
    if (job !== "all") params.set("job", job);
    return `/api/recruitment/reports/export?${params.toString()}`;
  };

  if (!report) {
    return (
      <>
        <PageHead
          title="Laporan"
          subtitle="Performa rekrutmen dari data asli, dihitung per periode dan lowongan."
        />
        <div className="card p-8 text-center">
          <div className="font-bold mb-1">Laporan belum dapat dimuat</div>
          <p className="sub text-[13px] mb-4">
            {error || initialError || "Silakan coba lagi."}
          </p>
          <button
            type="button"
            className="btn btn-p"
            onClick={() => void applyFilters(period, job)}
          >
            Coba lagi
          </button>
        </div>
      </>
    );
  }

  const summary = report.summary;
  const previous = summary.previous;

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        title="Laporan"
        subtitle="Performa rekrutmen dari data asli, dihitung per periode dan lowongan."
      >
        <details className="relative">
          <summary
            className="btn btn-g cursor-pointer [&::-webkit-details-marker]:hidden"
            style={{ listStyle: "none" }}
          >
            Ekspor CSV
          </summary>
          <div className="card absolute right-0 mt-2 p-2 z-30 min-w-[240px] shadow-lg">
            <a
              className="block px-3 py-2 rounded-lg text-[13px] hover:bg-[#F5F2EF]"
              href={exportUrl("jobs")}
            >
              Ringkasan per lowongan
            </a>
            <a
              className="block px-3 py-2 rounded-lg text-[13px] hover:bg-[#F5F2EF]"
              href={exportUrl("applicants")}
            >
              Daftar pelamar
            </a>
          </div>
        </details>
      </PageHead>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="report-period"
          className="text-[12px] sub font-semibold"
        >
          Periode
        </label>
        <select
          id="report-period"
          className="inp !w-auto"
          value={period}
          onChange={(event) => {
            if (isReportPeriod(event.target.value))
              void applyFilters(event.target.value, job);
          }}
          disabled={loading}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="report-job" className="text-[12px] sub font-semibold">
          Lowongan
        </label>
        <select
          id="report-job"
          className="inp !w-auto max-w-[280px]"
          value={job}
          onChange={(event) => void applyFilters(period, event.target.value)}
          disabled={loading || report.jobs.length === 0}
        >
          <option value="all">Semua lowongan</option>
          {report.jobs.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>

        {loading && (
          <span className="text-[12px] sub" role="status">
            Memuat laporan…
          </span>
        )}
        <span className="text-[12px] sub ml-auto">
          Periode dihitung dari tanggal melamar (WIB).
        </span>
      </div>

      {error && (
        <div
          className="card p-4 flex items-center justify-between gap-3"
          style={{ background: "var(--badb)", color: "var(--bad)" }}
        >
          <span className="text-[13px]">{error}</span>
          <button
            type="button"
            className="btn btn-g !py-1 !px-3 !text-[12px]"
            onClick={() => void applyFilters(period, job)}
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Total Pelamar"
          value={summary.total}
          hint={
            <Comparison
              current={summary.total}
              previous={previous?.total ?? null}
              hidden={period === "all"}
            />
          }
        />
        <MetricCard
          label="Sedang Diproses"
          value={summary.inProgress}
          hint={
            <Comparison
              current={summary.inProgress}
              previous={previous?.inProgress ?? null}
              hidden={period === "all"}
            />
          }
        />
        <MetricCard
          label="Diterima"
          value={summary.accepted}
          hint={
            <Comparison
              current={summary.accepted}
              previous={previous?.accepted ?? null}
              hidden={period === "all"}
            />
          }
        />
        <MetricCard
          label="Ditolak"
          value={summary.rejected}
          hint={
            <Comparison
              current={summary.rejected}
              previous={previous?.rejected ?? null}
              hidden={period === "all"}
            />
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <FunnelSection data={report} />
        <SpeedSection speed={report.speed} />
      </div>

      <PerJobSection rows={report.perJob} />

      <div className="grid lg:grid-cols-2 gap-6">
        <TrendSection points={report.trend} />
        <SourcesSection sources={report.sources} />
      </div>

      <InterviewsSection data={report.interviews} />
    </div>
  );
}
