"use client";

import { useMemo, useState } from "react";
import { AttendanceStatusTag } from "@/components/attendance/attendance-status-tag";
import { CorrectionDialog } from "@/components/attendance/correction-dialog";
import { CorrectionHistoryDrawer } from "@/components/attendance/correction-history-drawer";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatClockID } from "@/lib/datetime";
import {
  buildAttendanceDailyRows,
  buildAttendanceDailySummary,
  attendanceDepartmentOptions,
  ATTENDANCE_STATUS_FILTERS,
  DEFAULT_ATTENDANCE_DAILY_FILTERS,
  filterAttendanceDailyRows,
  type AttendanceDailyFilters,
} from "@/lib/attendance/query";
import {
  formatDurationMinutes,
  isoWeekday,
} from "@/lib/attendance/rules";
import type {
  AttendanceDailyData,
  AttendanceDailyRow,
} from "@/lib/attendance/types";

type DailyResponse = AttendanceDailyData & { error?: string };

export function DailyAttendanceView({
  initialData,
  initialDate,
}: {
  initialData: AttendanceDailyData;
  initialDate: string;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<AttendanceDailyFilters>(
    DEFAULT_ATTENDANCE_DAILY_FILTERS
  );
  const [correctionTarget, setCorrectionTarget] =
    useState<AttendanceDailyRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{
    employee: AttendanceDailyRow["employee"];
    date: string;
    corrections: AttendanceDailyRow["corrections"];
  } | null>(null);

  const rows = useMemo(
    () =>
      buildAttendanceDailyRows({
        date: data.date,
        todayIso: data.todayIso,
        employees: data.employees,
        attendance: data.attendance,
        corrections: data.corrections,
        schedule: data.schedule,
        holiday: data.holiday,
        leaveStatuses: data.leaveStatuses,
      }),
    [data]
  );

  const filteredRows = useMemo(
    () => filterAttendanceDailyRows(rows, filters),
    [rows, filters]
  );
  const summary = useMemo(() => buildAttendanceDailySummary(rows), [rows]);
  const departments = useMemo(
    () => attendanceDepartmentOptions(rows),
    [rows]
  );

  const isHoliday = Boolean(data.holiday);
  const isOffday = Boolean(
    data.schedule &&
      !data.schedule.workDays.includes(isoWeekday(data.date))
  );

  const loadDate = async (nextDate: string) => {
    if (!nextDate) return;
    setLoading(true);
    setCorrectionTarget(null);
    setHistoryTarget(null);
    setDate(nextDate);
    try {
      const response = await fetch(
        `/api/attendance/daily?date=${encodeURIComponent(nextDate)}`,
        { cache: "no-store" }
      );
      const body = (await response
        .json()
        .catch(() => null)) as DailyResponse | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat kehadiran harian");
      }
      setData(body);
    } catch (error) {
      setDate(data.date);
      toast(
        error instanceof Error
          ? error.message
          : "Gagal memuat kehadiran harian"
      );
    } finally {
      setLoading(false);
    }
  };

  const setFilter = <K extends keyof AttendanceDailyFilters>(
    key: K,
    value: AttendanceDailyFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.department !== "Semua" ||
    filters.status !== "Semua";

  const columns: DataTableColumn<AttendanceDailyRow>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "25%",
      render: (row) => (
        <TwoLineCell
          primary={row.employee.fullName}
          secondary={`${row.employee.department} · ${row.employee.id}`}
        />
      ),
    },
    {
      key: "times",
      label: "Masuk / Pulang",
      width: "17%",
      render: (row) => {
        const record = row.day.record;
        return (
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px]">
              {record?.checkInAt ? formatClockID(record.checkInAt) : "—"}
            </span>
            <span className="text-[11px] sub">
              {record?.checkOutAt ? formatClockID(record.checkOutAt) : "—"}
            </span>
            {record?.source === "Koreksi HR" && (
              <span className="tag t-mute">Koreksi</span>
            )}
          </span>
        );
      },
    },
    {
      key: "duration",
      label: "Durasi",
      width: "12%",
      render: (row) => (
        <span className="text-[12px]">
          {formatDurationMinutes(row.day.durationMinutes)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "26%",
      render: (row) => <AttendanceStatusTag day={row.day} />,
    },
    {
      key: "actions",
      label: "Aksi",
      width: "20%",
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          <button
            type="button"
            className="btn btn-g !py-1 !px-2 !text-[11px]"
            onClick={() => setCorrectionTarget(row)}
          >
            Koreksi
          </button>
          {row.corrections.length > 0 && (
            <button
              type="button"
              className="btn btn-g !py-1 !px-2 !text-[11px]"
              onClick={() =>
                setHistoryTarget({
                  employee: row.employee,
                  date: data.date,
                  corrections: row.corrections,
                })
              }
            >
              Riwayat ({row.corrections.length})
            </button>
          )}
        </span>
      ),
    },
  ];

  const summaryCards = [
    { label: "Hadir", value: summary.hadir },
    { label: "Terlambat", value: summary.terlambat },
    { label: "Belum Masuk", value: summary.belumMasuk },
    { label: "Alfa", value: summary.alfa },
    { label: "Belum Check-out", value: summary.belumCheckOut },
    { label: "Cuti/Izin/Sakit", value: summary.leave },
  ];

  return (
    <>
      <PageHead
        title="Kehadiran Harian"
        subtitle="Pantau, koreksi, dan telusuri kehadiran karyawan per tanggal."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={() => void loadDate(data.date)}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-5">
        {summaryCards.map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[24px] font-bold tracking-tight mt-1">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {(isHoliday || isOffday) && (
        <div
          className="card p-4 mb-5 text-[13px]"
          style={{ background: "#F6FBF4", borderColor: "#D8E8D2" }}
        >
          {isHoliday
            ? `Tanggal ini libur: ${data.holiday?.name}. Hari libur tidak dihitung Alfa.`
            : "Tanggal ini bukan hari kerja. Kehadiran tidak dihitung Alfa."}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="date"
          className="inp !w-auto"
          value={date}
          max={data.todayIso}
          disabled={loading}
          onChange={(event) => void loadDate(event.target.value)}
          aria-label="Pilih tanggal kehadiran"
        />

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
          aria-label="Filter status kehadiran"
        >
          {ATTENDANCE_STATUS_FILTERS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        {filtersActive && (
          <button
            type="button"
            className="btn btn-g"
            onClick={() => setFilters(DEFAULT_ATTENDANCE_DAILY_FILTERS)}
          >
            Reset filter
          </button>
        )}
      </div>

      <DataTable
        ariaLabel="Kehadiran harian karyawan"
        columns={columns}
        rows={filteredRows}
        rowKey={(row) => row.employee.id}
        empty={
          rows.length === 0
            ? "Tidak ada karyawan Aktif/Probation pada tanggal ini."
            : "Tidak ada karyawan yang cocok dengan pencarian/filter."
        }
        minWidth={860}
      />

      <CorrectionDialog
        open={correctionTarget !== null}
        employee={correctionTarget?.employee ?? null}
        date={data.date}
        record={correctionTarget?.day.record ?? null}
        beforeDay={correctionTarget?.day ?? null}
        schedule={data.schedule}
        holidayName={data.holiday?.name ?? null}
        todayIso={data.todayIso}
        onClose={() => setCorrectionTarget(null)}
        onSaved={(message) => {
          setCorrectionTarget(null);
          toast(message);
          void loadDate(data.date);
        }}
      />

      <CorrectionHistoryDrawer
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </>
  );
}
