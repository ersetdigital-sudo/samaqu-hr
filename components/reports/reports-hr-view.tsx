"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { ReportMetricCard } from "@/components/reports/report-ui";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import type {
  HrContractRow,
  HrDocumentRow,
  HrReportData,
} from "@/lib/reports/types";

const contractColumns: DataTableColumn<HrContractRow & { bucket: string }>[] = [
  {
    key: "bucket",
    label: "Rentang",
    width: "14%",
    render: (row) => <span className="tag t-mute">{row.bucket}</span>,
  },
  {
    key: "employee",
    label: "Karyawan",
    width: "34%",
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
    key: "end",
    label: "Berakhir",
    width: "24%",
    render: (row) => <span className="text-[13px]">{formatDateID(row.endDate)}</span>,
  },
];

const documentColumns: DataTableColumn<HrDocumentRow & { status: string }>[] = [
  {
    key: "status",
    label: "Status",
    width: "16%",
    render: (row) => (
      <span className={`tag ${row.status === "Kedaluwarsa" ? "t-bad" : "t-warn"}`}>
        {row.status}
      </span>
    ),
  },
  {
    key: "employee",
    label: "Karyawan",
    width: "28%",
    render: (row) => (
      <TwoLineCell primary={row.employeeName} secondary={row.department} />
    ),
  },
  {
    key: "document",
    label: "Dokumen",
    width: "34%",
    render: (row) => (
      <TwoLineCell primary={row.title} secondary={row.docType} />
    ),
  },
  {
    key: "valid",
    label: "Berlaku Sampai",
    width: "22%",
    render: (row) => <span className="text-[13px]">{formatDateID(row.validUntil)}</span>,
  },
];

export function ReportsHrView({ initialData }: { initialData: HrReportData }) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialData.referenceDate);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextDate: string) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/hr?date=${nextDate}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          data?: HrReportData;
          error?: string;
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error ?? "Gagal memuat laporan HR");
        }
        setData(body.data);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Gagal memuat laporan HR");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const setReferenceDate = (value: string) => {
    setDate(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) void load(value);
  };

  const contracts = [
    ...data.contracts.d30.map((row) => ({ ...row, bucket: "≤ 30 hari" })),
    ...data.contracts.d60.map((row) => ({ ...row, bucket: "31–60 hari" })),
    ...data.contracts.d90.map((row) => ({ ...row, bucket: "61–90 hari" })),
  ];
  const documents = [
    ...data.documents.expiring.map((row) => ({
      ...row,
      status: "Akan kedaluwarsa",
    })),
    ...data.documents.expired.map((row) => ({
      ...row,
      status: "Kedaluwarsa",
    })),
  ];

  return (
    <>
      <PageHead
        title="Laporan HR"
        subtitle="Komposisi karyawan, kontrak yang berakhir, dan dokumen kedaluwarsa."
      >
        <Link className="btn btn-g" href="/reports">
          Kembali
        </Link>
        <a
          className="btn btn-p"
          href={`/api/reports/hr/export?date=${date}`}
        >
          Ekspor XLSX
        </a>
      </PageHead>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label>
          <span className="lbl">Tanggal acuan</span>
          <input
            type="date"
            className="inp !w-auto"
            value={date}
            disabled={loading}
            onChange={(event) => setReferenceDate(event.target.value)}
          />
        </label>
        <span className="text-[11px] sub pb-2">
          {loading ? "Memuat…" : `Data per ${formatDateID(data.referenceDate)}`}
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
        <ReportMetricCard label="Karyawan Aktif" value={data.counts.active} />
        <ReportMetricCard label="Probation" value={data.counts.probation} />
        <ReportMetricCard label="Nonaktif" value={data.counts.inactive} />
        <ReportMetricCard
          label="Baru Bulan Ini"
          value={data.counts.newThisMonth}
        />
        <ReportMetricCard
          label="Keluar Bulan Ini"
          value={data.counts.leftThisMonth}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card p-5 xl:col-span-2">
          <div className="font-bold text-[14px] mb-3">Per Departemen</div>
          <DataTable
            ariaLabel="Jumlah karyawan per departemen"
            columns={[
              {
                key: "department",
                label: "Departemen",
                width: "36%",
                render: (row) => <span className="text-[13px]">{row.department}</span>,
              },
              {
                key: "total",
                label: "Total",
                width: "16%",
                render: (row) => <span className="text-[13px]">{row.total}</span>,
              },
              {
                key: "active",
                label: "Aktif",
                width: "16%",
                render: (row) => <span className="text-[13px]">{row.active}</span>,
              },
              {
                key: "probation",
                label: "Probation",
                width: "16%",
                render: (row) => <span className="text-[13px]">{row.probation}</span>,
              },
              {
                key: "inactive",
                label: "Nonaktif",
                width: "16%",
                render: (row) => <span className="text-[13px]">{row.inactive}</span>,
              },
            ]}
            rows={data.byDepartment}
            rowKey={(row) => row.department}
            empty="Belum ada data departemen."
            minWidth={620}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="font-bold text-[14px] mb-3">Per Status</div>
            <div className="flex flex-col gap-2">
              {data.byStatus.map((row) => (
                <div
                  className="flex items-center justify-between text-[13px]"
                  key={row.status}
                >
                  <span>{row.status}</span>
                  <b>{row.total}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <div className="font-bold text-[14px] mb-3">Per Tipe Kerja</div>
            <div className="flex flex-col gap-2">
              {data.byEmploymentType.map((row) => (
                <div
                  className="flex items-center justify-between text-[13px]"
                  key={row.employmentType}
                >
                  <span>{row.employmentType}</span>
                  <b>{row.total}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <div className="font-bold text-[14px] mb-1">Karyawan Baru & Keluar</div>
        <div className="text-[11px] sub mb-3">12 bulan terakhir.</div>
        <DataTable
          ariaLabel="Karyawan baru dan keluar per bulan"
          columns={[
            {
              key: "month",
              label: "Bulan",
              width: "40%",
              render: (row) => (
                <span className="text-[13px]">{formatDateID(row.monthStart)}</span>
              ),
            },
            {
              key: "new",
              label: "Masuk",
              width: "30%",
              render: (row) => <span className="text-[13px]">{row.newCount}</span>,
            },
            {
              key: "left",
              label: "Keluar",
              width: "30%",
              render: (row) => <span className="text-[13px]">{row.leftCount}</span>,
            },
          ]}
          rows={data.monthly}
          rowKey={(row) => row.monthStart}
          empty="Belum ada data bulanan."
          minWidth={560}
        />
      </div>

      <div className="card p-5 mb-4">
        <div className="font-bold text-[14px] mb-1">Kontrak Akan Berakhir</div>
        <div className="text-[11px] sub mb-3">
          Kontrak aktif yang berakhir dalam 30, 60, dan 90 hari.
        </div>
        <DataTable
          ariaLabel="Kontrak yang akan berakhir"
          columns={contractColumns}
          rows={contracts}
          rowKey={(row) => `${row.employeeId}-${row.endDate}`}
          empty="Tidak ada kontrak yang berakhir dalam 90 hari."
          minWidth={680}
        />
      </div>

      <div className="card p-5">
        <div className="font-bold text-[14px] mb-1">Dokumen Karyawan</div>
        <div className="text-[11px] sub mb-3">
          Dokumen yang kedaluwarsa atau akan berakhir dalam 30 hari.
        </div>
        <DataTable
          ariaLabel="Dokumen kedaluwarsa"
          columns={documentColumns}
          rows={documents}
          rowKey={(row) => `${row.employeeId}-${row.docType}-${row.validUntil}`}
          empty="Tidak ada dokumen yang perlu diperbarui."
          minWidth={720}
        />
      </div>
    </>
  );
}
