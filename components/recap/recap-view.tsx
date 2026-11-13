"use client";

import { useCallback, useMemo, useState } from "react";
import { MonthNavigation } from "@/components/attendance/month-navigation";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { RecapEmployeeDrawer } from "@/components/recap/recap-employee-drawer";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import {
  formatDurationMinutes,
  shiftMonth,
} from "@/lib/attendance/rules";
import {
  buildRecapSummary,
  filterRecapRows,
  recapDepartmentOptions,
  sortRecapRows,
} from "@/lib/recap/rules";
import type {
  RecapData,
  RecapFilters,
  RecapRow,
  RecapSort,
  RecapSortKey,
} from "@/lib/recap/types";

const DEFAULT_FILTERS: RecapFilters = {
  q: "",
  department: "Semua",
  status: "Semua",
};

export function RecapView({ initialData }: { initialData: RecapData }) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<RecapFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<RecapSort>({
    key: "employee",
    direction: "asc",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentMonth = initialData.todayIso.slice(0, 7);
  const departments = useMemo(
    () => recapDepartmentOptions(data.rows),
    [data.rows]
  );
  const filteredRows = useMemo(
    () => sortRecapRows(filterRecapRows(data.rows, filters), sort),
    [data.rows, filters, sort]
  );
  const summary = useMemo(
    () => buildRecapSummary(filteredRows),
    [filteredRows]
  );
  const selected =
    data.rows.find((row) => row.employee.id === selectedId) ?? null;

  const loadMonth = useCallback(
    async (nextMonth: string) => {
      setLoading(true);
      setSelectedId(null);
      try {
        const response = await fetch(
          `/api/recap?month=${encodeURIComponent(nextMonth)}`,
          { cache: "no-store" }
        );
        const body = (await response
          .json()
          .catch(() => null)) as (RecapData & { error?: string }) | null;
        if (!response.ok || !body) {
          throw new Error(body?.error ?? "Gagal memuat rekap kehadiran");
        }
        setData(body);
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat rekap kehadiran"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const refresh = () => {
    void loadMonth(data.period.month);
  };

  const changeMonth = (delta: number) => {
    const next = shiftMonth(data.period.month, delta);
    if (next > currentMonth) return;
    void loadMonth(next);
  };

  const setFilter = <K extends keyof RecapFilters>(
    key: K,
    value: RecapFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.department !== "Semua" ||
    filters.status !== "Semua";

  const toggleSort = (key: RecapSortKey) => {
    setSort((current) =>
      current.key === key
        ? {
            key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key, direction: key === "employee" ? "asc" : "desc" }
    );
  };

  const sortLabel = (key: RecapSortKey, label: string) => (
    <button
      type="button"
      className="text-left font-semibold"
      style={{
        background: "none",
        border: 0,
        padding: 0,
        color: "inherit",
        cursor: "pointer",
      }}
      onClick={() => toggleSort(key)}
      title={`Urutkan ${label}`}
    >
      {label}
      {sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  const exportHref = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams({
      month: data.period.month,
      format,
      q: filters.q,
      department: filters.department,
      status: filters.status,
    });
    return `/api/recap/export?${params.toString()}`;
  };

  const columns: DataTableColumn<RecapRow>[] = [
    {
      key: "employee",
      label: sortLabel("employee", "Karyawan"),
      width: "18%",
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <TwoLineCell
            primary={row.employee.fullName}
            secondary={`${row.employee.department} · ${row.employee.status}`}
          />
          {row.employee.status === "Nonaktif" && (
            <span
              className={`tag ${
                row.employee.inactiveDateKnown ? "t-mute" : "t-warn"
              }`}
            >
              {row.employee.inactiveDateKnown
                ? `Aktif s/d ${formatDateID(row.employee.activeEndDate)}`
                : "Masa aktif tidak tercatat"}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "workdays",
      label: sortLabel("workdays", "Hari Kerja"),
      width: "7%",
      render: (row) => <span className="text-[13px]">{row.workdays}</span>,
    },
    {
      key: "present",
      label: sortLabel("present", "Hadir"),
      width: "6%",
      render: (row) => <b className="text-[13px]">{row.present}</b>,
    },
    {
      key: "late",
      label: sortLabel("late", "Terlambat"),
      width: "8%",
      render: (row) =>
        row.lateCount > 0 ? (
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">
              {row.lateCount}×
            </span>
            <span className="text-[10px] sub">{row.lateMinutes} mnt</span>
          </span>
        ) : (
          <span className="text-[12px] sub">—</span>
        ),
    },
    {
      key: "early",
      label: sortLabel("early", "Pulang Cepat"),
      width: "8%",
      render: (row) =>
        row.earlyCount > 0 ? (
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">
              {row.earlyCount}×
            </span>
            <span className="text-[10px] sub">{row.earlyMinutes} mnt</span>
          </span>
        ) : (
          <span className="text-[12px] sub">—</span>
        ),
    },
    {
      key: "missing",
      label: sortLabel("missing", "Lupa Check-out"),
      width: "8%",
      render: (row) =>
        row.missingCheckout > 0 ? (
          <span className="tag t-warn">{row.missingCheckout} hari</span>
        ) : (
          <span className="text-[12px] sub">—</span>
        ),
    },
    {
      key: "alfa",
      label: sortLabel("alfa", "Alfa"),
      width: "6%",
      render: (row) =>
        row.alfa > 0 ? (
          <span className="tag t-bad">{row.alfa}</span>
        ) : (
          <span className="text-[12px] sub">0</span>
        ),
    },
    {
      key: "cuti",
      label: sortLabel("cuti", "Cuti"),
      width: "5%",
      render: (row) => <span className="text-[12px]">{row.cuti}</span>,
    },
    {
      key: "sakit",
      label: sortLabel("sakit", "Sakit"),
      width: "5%",
      render: (row) => <span className="text-[12px]">{row.sakit}</span>,
    },
    {
      key: "izin",
      label: sortLabel("izin", "Izin"),
      width: "5%",
      render: (row) => <span className="text-[12px]">{row.izin}</span>,
    },
    {
      key: "workMinutes",
      label: sortLabel("workMinutes", "Jam Kerja"),
      width: "9%",
      render: (row) => (
        <span className="text-[12px]">
          {formatDurationMinutes(row.workMinutes)}
        </span>
      ),
    },
    {
      key: "attendancePercent",
      label: sortLabel("attendancePercent", "Kehadiran"),
      width: "9%",
      render: (row) => (
        <span
          className={`tag ${
            row.attendancePercent >= 90
              ? "t-ok"
              : row.attendancePercent >= 75
                ? "t-warn"
                : "t-bad"
          }`}
        >
          {row.attendancePercent}%
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="Rekap Kehadiran"
        subtitle="Rekap bulanan per karyawan sebagai bahan payroll. Selalu dihitung ulang dari data terbaru."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <MonthNavigation
          month={data.period.month}
          disableNext={data.period.month >= currentMonth || loading}
          onChange={changeMonth}
        />
        <div className="text-[12px] sub">
          Periode {formatDateID(data.period.from)} –{" "}
          {formatDateID(data.period.to)}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn btn-g" href={exportHref("csv")}>
            Ekspor CSV
          </a>
          <a className="btn btn-g" href={exportHref("xlsx")}>
            Ekspor XLSX
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: "Rata-rata Kehadiran",
            value: `${summary.averageAttendance}%`,
            hint: "dari karyawan yang punya hari kerja",
          },
          {
            label: "Total Alfa",
            value: summary.totalAlfa,
            hint: "hari tidak hadir tanpa cuti",
          },
          {
            label: "Total Menit Terlambat",
            value: `${summary.totalLateMinutes} mnt`,
            hint: "akumulasi periode",
          },
          {
            label: "Karyawan Lupa Check-out",
            value: summary.missingCheckoutEmployees,
            hint: "perlu dikoreksi sebelum payroll",
          },
        ].map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[24px] font-bold tracking-tight mt-1">
              {card.value}
            </div>
            <div className="text-[10px] sub">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full md:w-64">
          <input
            className="inp inp-search"
            placeholder="Cari nama atau Employee ID…"
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
          />
          <Icon name="search" className="search-icon" />
        </div>

        <select
          className="inp !w-auto"
          value={filters.department}
          onChange={(event) => setFilter("department", event.target.value)}
          aria-label="Filter departemen"
        >
          {["Semua", ...departments].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.status}
          onChange={(event) => setFilter("status", event.target.value)}
          aria-label="Filter status karyawan"
        >
          {["Semua", "Aktif", "Probation", "Nonaktif"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        {filtersActive && (
          <button
            type="button"
            className="btn btn-g"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Reset filter
          </button>
        )}
      </div>

      <div className="text-[11px] sub mb-3">
        Karyawan baru dihitung mulai tanggal bergabung. Karyawan Nonaktif
        dihitung sampai akhir masa aktif yang tercatat. Koreksi hari bermasalah
        dilakukan lewat Kehadiran Harian.
      </div>

      <DataTable
        ariaLabel="Rekap kehadiran bulanan karyawan"
        columns={columns}
        rows={filteredRows}
        rowKey={(row) => row.employee.id}
        rowLabel={(row) =>
          `Buka detail rekap ${row.employee.fullName}`
        }
        onRowActivate={(row) => setSelectedId(row.employee.id)}
        rowAction={{
          ariaLabel: (row) => `Lihat detail rekap ${row.employee.fullName}`,
          label: "Lihat detail",
        }}
        empty={
          data.rows.length === 0
            ? "Belum ada karyawan pada periode ini."
            : "Tidak ada karyawan yang cocok dengan filter."
        }
        minWidth={1180}
      />

      <RecapEmployeeDrawer
        row={selected}
        period={data.period}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
