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
  EmployeeExportData,
  EmployeeExportRow,
} from "@/lib/reports/types";

export function ReportsEmployeeExportView({
  initialData,
}: {
  initialData: EmployeeExportData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState("Semua");
  const [department, setDepartment] = useState("Semua");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextStatus: string, nextDepartment: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: nextStatus,
          department: nextDepartment,
        });
        const response = await fetch(`/api/reports/employees?${params}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          data?: EmployeeExportData;
          error?: string;
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error ?? "Gagal memuat daftar karyawan");
        }
        setData(body.data);
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat daftar karyawan"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const setFilter = (nextStatus: string, nextDepartment: string) => {
    setStatus(nextStatus);
    setDepartment(nextDepartment);
    void load(nextStatus, nextDepartment);
  };

  const columns: DataTableColumn<EmployeeExportRow>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "30%",
      render: (row) => (
        <TwoLineCell
          primary={row.fullName}
          secondary={`${row.employeeId} · ${row.position}`}
        />
      ),
    },
    {
      key: "department",
      label: "Departemen",
      width: "20%",
      render: (row) => <span className="text-[13px]">{row.department}</span>,
    },
    {
      key: "manager",
      label: "Atasan",
      width: "20%",
      render: (row) => <span className="text-[13px]">{row.managerName}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "12%",
      render: (row) => (
        <span
          className={`tag ${
            row.status === "Aktif"
              ? "t-ok"
              : row.status === "Probation"
                ? "t-info"
                : "t-mute"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "type",
      label: "Tipe / Lokasi",
      width: "18%",
      render: (row) => (
        <TwoLineCell primary={row.employmentType} secondary={row.location} />
      ),
    },
    {
      key: "joined",
      label: "Bergabung",
      width: "14%",
      render: (row) => (
        <span className="text-[13px]">{formatDateID(row.joinedAt)}</span>
      ),
    },
  ];

  const exportParams = new URLSearchParams({ status, department });

  return (
    <>
      <PageHead
        title="Ekspor Data"
        subtitle="Unduh Daftar Karyawan dengan kolom aman. Tidak ada data sensitif."
      >
        <Link className="btn btn-g" href="/reports">
          Kembali
        </Link>
        <a
          className="btn btn-p"
          href={`/api/reports/employees/export?${exportParams.toString()}`}
        >
          Ekspor XLSX
        </a>
      </PageHead>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label>
          <span className="lbl">Status</span>
          <select
            className="inp !w-auto"
            value={status}
            disabled={loading}
            onChange={(event) => setFilter(event.target.value, department)}
          >
            <option value="Semua">Semua status</option>
            <option value="Aktif">Aktif</option>
            <option value="Probation">Probation</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </label>
        <label>
          <span className="lbl">Departemen</span>
          <select
            className="inp !w-auto"
            value={department}
            disabled={loading}
            onChange={(event) => setFilter(status, event.target.value)}
          >
            <option value="Semua">Semua departemen</option>
            {data.departments.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] sub pb-2">
          {loading ? "Memuat…" : `${data.counts.total} karyawan`}
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <ReportMetricCard label="Total Baris" value={data.counts.total} />
        <ReportMetricCard label="Aktif" value={data.counts.active} />
        <ReportMetricCard label="Probation" value={data.counts.probation} />
        <ReportMetricCard label="Nonaktif" value={data.counts.inactive} />
      </div>

      <div className="card p-4 mb-4 text-[12px] sub">
        Kolom ekspor: ID karyawan, nama, departemen, jabatan, atasan, status,
        tipe kerja, lokasi, dan tanggal bergabung. NIK, NPWP, rekening, alamat,
        tanggal lahir, telepon, gaji, dan dokumen tidak disertakan.
      </div>

      <div className="card p-5">
        <DataTable
          ariaLabel="Pratinjau daftar karyawan"
          columns={columns}
          rows={data.rows}
          rowKey={(row) => row.employeeId}
          empty="Tidak ada karyawan yang cocok dengan filter."
          minWidth={980}
        />
      </div>
    </>
  );
}
