"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PageHead } from "@/components/page-head";
import { PerformanceCategoryTag } from "@/components/performance/performance-tags";
import { useRecruitment } from "@/components/recruitment-provider";
import { ReportMetricCard } from "@/components/reports/report-ui";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import { formatPerformanceScore } from "@/lib/performance/rules";
import type {
  PerformanceReportAspect,
  PerformanceReportData,
  PerformanceReportDepartment,
  PerformanceReportEmployee,
} from "@/lib/reports/types";

export function ReportsPerformanceView({
  initialData,
}: {
  initialData: PerformanceReportData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState(initialData.selectedPeriod ?? "");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextPeriod: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (nextPeriod) params.set("period", nextPeriod);
        const response = await fetch(`/api/reports/performance?${params}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          data?: PerformanceReportData;
          error?: string;
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error ?? "Gagal memuat laporan performance");
        }
        setData(body.data);
        setPeriod(body.data.selectedPeriod ?? "");
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat laporan performance"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const aspectColumns: DataTableColumn<PerformanceReportAspect>[] = [
    {
      key: "aspect",
      label: "Aspek",
      width: "60%",
      render: (row) => (
        <TwoLineCell primary={row.aspectName} secondary={row.aspectDescription} />
      ),
    },
    {
      key: "average",
      label: "Rata-rata",
      width: "20%",
      render: (row) => (
        <b className="text-[13px]">{formatPerformanceScore(row.averageScore)}</b>
      ),
    },
    {
      key: "count",
      label: "Dinilai",
      width: "20%",
      render: (row) => <span className="text-[13px]">{row.scoredCount}</span>,
    },
  ];

  const departmentColumns: DataTableColumn<PerformanceReportDepartment>[] = [
    {
      key: "department",
      label: "Departemen",
      width: "28%",
      render: (row) => <span className="text-[13px]">{row.department}</span>,
    },
    {
      key: "final",
      label: "Final",
      width: "10%",
      render: (row) => <span className="text-[13px]">{row.finalCount}</span>,
    },
    {
      key: "average",
      label: "Rata-rata",
      width: "14%",
      render: (row) => (
        <b className="text-[13px]">{formatPerformanceScore(row.averageScore)}</b>
      ),
    },
    {
      key: "sangat",
      label: "Sangat Baik",
      width: "12%",
      render: (row) => <span className="text-[13px]">{row.sangatBaik}</span>,
    },
    {
      key: "baik",
      label: "Baik",
      width: "12%",
      render: (row) => <span className="text-[13px]">{row.baik}</span>,
    },
    {
      key: "cukup",
      label: "Cukup",
      width: "12%",
      render: (row) => <span className="text-[13px]">{row.cukup}</span>,
    },
    {
      key: "perlu",
      label: "Perlu Perbaikan",
      width: "12%",
      render: (row) => <span className="text-[13px]">{row.perluPerbaikan}</span>,
    },
  ];

  const employeeColumns: DataTableColumn<PerformanceReportEmployee>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "42%",
      render: (row) => (
        <TwoLineCell primary={row.employeeName} secondary={row.employeeId} />
      ),
    },
    {
      key: "department",
      label: "Departemen",
      width: "28%",
      render: (row) => <span className="text-[13px]">{row.department}</span>,
    },
    {
      key: "score",
      label: "Skor Akhir",
      width: "14%",
      render: (row) => (
        <b className="text-[13px]">{formatPerformanceScore(row.finalScore)}</b>
      ),
    },
    {
      key: "category",
      label: "Kategori",
      width: "16%",
      render: (row) => (
        <PerformanceCategoryTag
          category={row.finalCategory as "Sangat Baik" | "Baik" | "Cukup" | "Perlu Perbaikan"}
        />
      ),
    },
  ];

  const selectedPeriod = data.periods.find((row) => row.id === data.selectedPeriod);

  return (
    <>
      <PageHead
        title="Laporan Performance"
        subtitle="Hanya lembar Final yang dihitung. Catatan penilai tidak ditampilkan."
      >
        <Link className="btn btn-g" href="/reports">
          Kembali
        </Link>
        {data.selectedPeriod && (
          <a
            className="btn btn-p"
            href={`/api/reports/performance/export?period=${data.selectedPeriod}`}
          >
            Ekspor XLSX
          </a>
        )}
      </PageHead>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label>
          <span className="lbl">Periode penilaian</span>
          <select
            className="inp !w-auto max-w-[420px]"
            value={period}
            disabled={loading || data.periods.length === 0}
            onChange={(event) => {
              setPeriod(event.target.value);
              void load(event.target.value);
            }}
          >
            {data.periods.length === 0 && <option value="">Belum ada periode</option>}
            {data.periods.map((row) => (
              <option value={row.id} key={row.id}>
                {row.name} · {row.status}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] sub pb-2">
          {loading
            ? "Memuat…"
            : selectedPeriod
              ? `${formatDateID(selectedPeriod.startDate)}–${formatDateID(selectedPeriod.endDate)}`
              : "Belum ada periode penilaian."}
        </span>
      </div>

      {!data.selectedPeriod ? (
        <div className="card p-8 text-center">
          <div className="font-semibold text-[15px]">Belum ada periode</div>
          <div className="sub text-[13px] mt-2">
            Laporan muncul setelah periode penilaian dibuat.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
            <ReportMetricCard label="Final" value={data.counts.final} />
            <ReportMetricCard label="Dikirim" value={data.counts.dikirim} />
            <ReportMetricCard
              label="Tidak lengkap"
              value={data.counts.tidakLengkap}
            />
            <ReportMetricCard
              label="Dikecualikan"
              value={data.counts.dikecualikan}
            />
            <ReportMetricCard
              label="Rata-rata Skor Akhir"
              value={formatPerformanceScore(data.averageScore)}
            />
          </div>

          <div className="card p-5 mb-4">
            <div className="font-bold text-[14px] mb-3">Rata-rata per Aspek</div>
            <DataTable
              ariaLabel="Rata-rata skor per aspek"
              columns={aspectColumns}
              rows={data.aspects}
              rowKey={(row) => row.aspectName}
              empty="Belum ada lembar Final pada periode ini."
              minWidth={720}
            />
          </div>

          <div className="card p-5 mb-4">
            <div className="font-bold text-[14px] mb-3">
              Rata-rata dan Sebaran Kategori per Departemen
            </div>
            <DataTable
              ariaLabel="Rata-rata performance per departemen"
              columns={departmentColumns}
              rows={data.departments}
              rowKey={(row) => row.department}
              empty="Belum ada lembar Final pada periode ini."
              minWidth={980}
            />
          </div>

          <div className="card p-5">
            <div className="font-bold text-[14px] mb-3">
              Skor Akhir per Karyawan
            </div>
            <DataTable
              ariaLabel="Skor akhir per karyawan"
              columns={employeeColumns}
              rows={data.employees}
              rowKey={(row) => row.employeeId}
              empty="Belum ada lembar Final pada periode ini."
              minWidth={760}
            />
          </div>
        </>
      )}
    </>
  );
}
