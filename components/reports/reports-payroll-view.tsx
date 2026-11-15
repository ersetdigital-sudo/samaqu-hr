"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { ReportMetricCard } from "@/components/reports/report-ui";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatRupiah } from "@/lib/payroll/rules";
import {
  formatReportDelta,
  formatReportDeltaRupiah,
  formatReportMonth,
} from "@/lib/reports/rules";
import type {
  PayrollDepartmentRow,
  PayrollReportData,
} from "@/lib/reports/types";

export function ReportsPayrollView({
  initialData,
}: {
  initialData: PayrollReportData;
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
        const response = await fetch(`/api/reports/payroll?${params}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          data?: PayrollReportData;
          error?: string;
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error ?? "Gagal memuat laporan payroll");
        }
        setData(body.data);
        setPeriod(body.data.selectedPeriod ?? "");
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Gagal memuat laporan payroll"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const totals = data.totals;
  const previous = data.previous;

  const columns: DataTableColumn<PayrollDepartmentRow>[] = [
    {
      key: "department",
      label: "Departemen",
      width: "24%",
      render: (row) => <span className="text-[13px]">{row.department}</span>,
    },
    {
      key: "employees",
      label: "Karyawan",
      width: "10%",
      render: (row) => <span className="text-[13px]">{row.employees}</span>,
    },
    {
      key: "gross",
      label: "Bruto",
      width: "16%",
      render: (row) => <span className="text-[13px]">{formatRupiah(row.grossTotal)}</span>,
    },
    {
      key: "deduction",
      label: "Potongan",
      width: "16%",
      render: (row) => (
        <span className="text-[13px]">{formatRupiah(row.deductionTotal)}</span>
      ),
    },
    {
      key: "pph",
      label: "PPh 21",
      width: "14%",
      render: (row) => <span className="text-[13px]">{formatRupiah(row.pph21Total)}</span>,
    },
    {
      key: "thp",
      label: "Take Home Pay",
      width: "16%",
      render: (row) => <b className="text-[13px]">{formatRupiah(row.takeHomeTotal)}</b>,
    },
    {
      key: "cost",
      label: "Biaya Perusahaan",
      width: "16%",
      render: (row) => (
        <span className="text-[13px]">{formatRupiah(row.employerCostTotal)}</span>
      ),
    },
  ];

  const bpjsRows = data.bpjs
    ? [
        {
          component: "BPJS Kesehatan",
          employee: data.bpjs.kesehatanEmployee,
          employer: data.bpjs.kesehatanEmployer,
        },
        {
          component: "JHT",
          employee: data.bpjs.jhtEmployee,
          employer: data.bpjs.jhtEmployer,
        },
        {
          component: "JP",
          employee: data.bpjs.jpEmployee,
          employer: data.bpjs.jpEmployer,
        },
        { component: "JKK", employee: null, employer: data.bpjs.jkkEmployer },
        { component: "JKM", employee: null, employer: data.bpjs.jkmEmployer },
      ]
    : [];

  return (
    <>
      <PageHead
        title="Laporan Payroll"
        subtitle="Agregat run Final/Dibayar. Tidak menampilkan gaji per orang, NPWP, atau rekening."
      >
        <Link className="btn btn-g" href="/reports">
          Kembali
        </Link>
        {data.selectedPeriod && (
          <a
            className="btn btn-p"
            href={`/api/reports/payroll/export?period=${data.selectedPeriod}`}
          >
            Ekspor XLSX
          </a>
        )}
      </PageHead>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label>
          <span className="lbl">Periode payroll</span>
          <select
            className="inp !w-auto"
            value={period}
            disabled={loading || data.periods.length === 0}
            onChange={(event) => {
              setPeriod(event.target.value);
              void load(event.target.value);
            }}
          >
            {data.periods.length === 0 && <option value="">Belum ada run Final</option>}
            {data.periods.map((row) => (
              <option value={row.periodMonth} key={row.id}>
                {formatReportMonth(row.periodMonth.slice(0, 7))} · {row.status}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] sub pb-2">
          {loading ? "Memuat…" : "Draft dan Direvisi tidak dihitung."}
        </span>
      </div>

      {!totals ? (
        <div className="card p-8 text-center">
          <div className="font-semibold text-[15px]">Belum ada payroll Final</div>
          <div className="sub text-[13px] mt-2">
            Laporan muncul setelah run payroll difinalisasi atau dibayar.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
            <ReportMetricCard
              label="Jumlah Karyawan"
              value={totals.employeeCount}
              hint={formatReportDelta(
                totals.employeeCount,
                previous?.employeeCount ?? null
              )}
            />
            <ReportMetricCard
              label="Total Bruto"
              value={formatRupiah(totals.grossTotal)}
              hint={formatReportDeltaRupiah(
                totals.grossTotal,
                previous?.grossTotal ?? null
              )}
            />
            <ReportMetricCard
              label="Total Potongan"
              value={formatRupiah(totals.deductionTotal)}
              hint={formatReportDeltaRupiah(
                totals.deductionTotal,
                previous?.deductionTotal ?? null
              )}
            />
            <ReportMetricCard
              label="Total PPh 21"
              value={formatRupiah(totals.pph21Total)}
              hint={formatReportDeltaRupiah(
                totals.pph21Total,
                previous?.pph21Total ?? null
              )}
            />
            <ReportMetricCard
              label="Take Home Pay"
              value={formatRupiah(totals.takeHomeTotal)}
              hint={formatReportDeltaRupiah(
                totals.takeHomeTotal,
                previous?.takeHomeTotal ?? null
              )}
            />
            <ReportMetricCard
              label="Biaya Perusahaan"
              value={formatRupiah(totals.employerCostTotal)}
              hint={formatReportDeltaRupiah(
                totals.employerCostTotal,
                previous?.employerCostTotal ?? null
              )}
            />
          </div>

          <div className="card p-5 mb-4">
            <div className="font-bold text-[14px] mb-1">Ringkasan per Departemen</div>
            <div className="text-[11px] sub mb-3">
              Hanya agregat departemen; tidak ada data gaji per individu.
            </div>
            <DataTable
              ariaLabel="Ringkasan payroll per departemen"
              columns={columns}
              rows={data.departments}
              rowKey={(row) => row.department}
              empty="Belum ada data departemen."
              minWidth={1080}
            />
          </div>

          <div className="card p-5">
            <div className="font-bold text-[14px] mb-1">Total BPJS per Komponen</div>
            <div className="text-[11px] sub mb-3">
              Untuk kebutuhan setoran; bagian karyawan dan perusahaan dipisah.
            </div>
            <DataTable
              ariaLabel="Total BPJS per komponen"
              columns={[
                {
                  key: "component",
                  label: "Komponen",
                  width: "34%",
                  render: (row) => <span className="text-[13px]">{row.component}</span>,
                },
                {
                  key: "employee",
                  label: "Bagian Karyawan",
                  width: "33%",
                  render: (row) => (
                    <span className="text-[13px]">
                      {row.employee === null ? "—" : formatRupiah(row.employee)}
                    </span>
                  ),
                },
                {
                  key: "employer",
                  label: "Bagian Perusahaan",
                  width: "33%",
                  render: (row) => (
                    <span className="text-[13px]">{formatRupiah(row.employer)}</span>
                  ),
                },
              ]}
              rows={bpjsRows}
              rowKey={(row) => row.component}
              empty="Belum ada data BPJS."
              minWidth={620}
            />
          </div>
        </>
      )}
    </>
  );
}
