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
import {
  formatMinutesAsDuration,
  formatReportMonth,
} from "@/lib/reports/rules";
import type {
  AttendanceDepartmentRow,
  AttendanceReportData,
  AttendanceReportRow,
} from "@/lib/reports/types";

export function ReportsAttendanceView({
  initialData,
}: {
  initialData: AttendanceReportData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialData.month);
  const [department, setDepartment] = useState("Semua");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextMonth: string, nextDepartment: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          month: nextMonth,
          department: nextDepartment,
        });
        const response = await fetch(`/api/reports/attendance?${params}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          data?: AttendanceReportData;
          error?: string;
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error ?? "Gagal memuat laporan kehadiran");
        }
        setData(body.data);
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat laporan kehadiran"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const setFilter = (nextMonth: string, nextDepartment: string) => {
    setMonth(nextMonth);
    setDepartment(nextDepartment);
    void load(nextMonth, nextDepartment);
  };

  const allDepartmentNames = [
    ...new Set(initialData.departments.map((row) => row.department)),
  ];
  const departments = [
    ...new Set([
      ...allDepartmentNames,
      ...data.departments.map((row) => row.department),
    ]),
  ].sort((a, b) => a.localeCompare(b, "id"));

  const columns: DataTableColumn<AttendanceReportRow>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "24%",
      render: (row) => (
        <TwoLineCell
          primary={row.employeeName}
          secondary={`${row.department} · ${row.employeeId}`}
        />
      ),
    },
    {
      key: "workdays",
      label: "Hari Kerja",
      width: "10%",
      render: (row) => <span className="text-[13px]">{row.workdays}</span>,
    },
    {
      key: "present",
      label: "Hadir",
      width: "10%",
      render: (row) => <span className="text-[13px]">{row.present}</span>,
    },
    {
      key: "late",
      label: "Terlambat",
      width: "16%",
      render: (row) => (
        <TwoLineCell
          primary={`${row.lateCount} kali`}
          secondary={formatMinutesAsDuration(row.lateMinutes)}
        />
      ),
    },
    {
      key: "alfa",
      label: "Alfa",
      width: "8%",
      render: (row) => <span className="text-[13px]">{row.alfa}</span>,
    },
    {
      key: "cuti",
      label: "Cuti",
      width: "8%",
      render: (row) => <span className="text-[13px]">{row.cuti}</span>,
    },
    {
      key: "izin",
      label: "Izin",
      width: "8%",
      render: (row) => <span className="text-[13px]">{row.izin}</span>,
    },
    {
      key: "overtime",
      label: "Lembur Disetujui",
      width: "16%",
      render: (row) => (
        <span className="text-[13px]">
          {formatMinutesAsDuration(row.overtimeApprovedMinutes)}
        </span>
      ),
    },
  ];

  const departmentColumns: DataTableColumn<AttendanceDepartmentRow>[] = [
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
      key: "workdays",
      label: "Hari Kerja",
      width: "11%",
      render: (row) => <span className="text-[13px]">{row.workdays}</span>,
    },
    {
      key: "present",
      label: "Hadir",
      width: "9%",
      render: (row) => <span className="text-[13px]">{row.present}</span>,
    },
    {
      key: "late",
      label: "Terlambat",
      width: "14%",
      render: (row) => (
        <TwoLineCell
          primary={`${row.lateCount} kali`}
          secondary={formatMinutesAsDuration(row.lateMinutes)}
        />
      ),
    },
    {
      key: "alfa",
      label: "Alfa",
      width: "8%",
      render: (row) => <span className="text-[13px]">{row.alfa}</span>,
    },
    {
      key: "overtime",
      label: "Lembur",
      width: "12%",
      render: (row) => (
        <span className="text-[13px]">
          {formatMinutesAsDuration(row.overtimeApprovedMinutes)}
        </span>
      ),
    },
  ];

  const totals = data.rows.reduce(
    (acc, row) => ({
      present: acc.present + row.present,
      lateCount: acc.lateCount + row.lateCount,
      alfa: acc.alfa + row.alfa,
      overtime: acc.overtime + row.overtimeApprovedMinutes,
    }),
    { present: 0, lateCount: 0, alfa: 0, overtime: 0 }
  );

  return (
    <>
      <PageHead
        title="Laporan Kehadiran"
        subtitle="Angka identik dengan Rekap Kehadiran; hanya tanggal yang sudah lewat yang dihitung."
      >
        <Link className="btn btn-g" href="/reports">
          Kembali
        </Link>
        <a
          className="btn btn-p"
          href={`/api/reports/attendance/export?month=${month}&department=${encodeURIComponent(department)}`}
        >
          Ekspor XLSX
        </a>
      </PageHead>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label>
          <span className="lbl">Periode rekap</span>
          <input
            type="month"
            className="inp !w-auto"
            value={month}
            disabled={loading}
            onChange={(event) => setFilter(event.target.value, department)}
          />
        </label>
        <label>
          <span className="lbl">Departemen</span>
          <select
            className="inp !w-auto"
            value={department}
            disabled={loading}
            onChange={(event) => setFilter(month, event.target.value)}
          >
            <option value="Semua">Semua departemen</option>
            {departments.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] sub pb-2">
          {loading
            ? "Memuat…"
            : `${formatReportMonth(data.month)} · ${formatDateID(data.period.from)}–${formatDateID(data.period.to)}`}
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
        <ReportMetricCard label="Karyawan" value={data.rows.length} />
        <ReportMetricCard
          label="Total Hadir"
          value={totals.present}
          hint={`${data.rows.reduce((sum, row) => sum + row.workdays, 0)} hari kerja`}
        />
        <ReportMetricCard
          label="Terlambat"
          value={`${totals.lateCount} kali`}
          hint={formatMinutesAsDuration(
            data.rows.reduce((sum, row) => sum + row.lateMinutes, 0)
          )}
        />
        <ReportMetricCard label="Alfa" value={totals.alfa} />
        <ReportMetricCard
          label="Lembur Disetujui"
          value={formatMinutesAsDuration(totals.overtime)}
        />
      </div>

      <div className="card p-5 mb-4">
        <div className="font-bold text-[14px] mb-1">Ringkasan per Departemen</div>
        <div className="text-[11px] sub mb-3">
          Filter departemen diterapkan pada tabel ini.
        </div>
        <DataTable
          ariaLabel="Ringkasan kehadiran per departemen"
          columns={departmentColumns}
          rows={data.departments}
          rowKey={(row) => row.department}
          empty="Belum ada data kehadiran pada periode ini."
          minWidth={920}
        />
      </div>

      <div className="card p-5">
        <div className="font-bold text-[14px] mb-1">Rekap per Karyawan</div>
        <div className="text-[11px] sub mb-3">
          Sumber: Rekap Kehadiran. Hari kerja mengikuti jadwal dan cut-off periode.
        </div>
        <DataTable
          ariaLabel="Rekap kehadiran per karyawan"
          columns={columns}
          rows={data.rows}
          rowKey={(row) => row.employeeId}
          empty="Belum ada data kehadiran pada periode ini."
          minWidth={1040}
        />
      </div>
    </>
  );
}
