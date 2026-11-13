"use client";

import { useCallback, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { OvertimeApprovedCell } from "@/components/overtime/overtime-approved-cell";
import { OvertimeDetailDrawer } from "@/components/overtime/overtime-detail-drawer";
import { OvertimeDayTag, OvertimeStatusTag } from "@/components/overtime/overtime-tags";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import {
  buildOvertimeApprovalStats,
  filterOvertimeRequests,
  overtimeDepartmentOptions,
  overtimeHoursLabel,
} from "@/lib/overtime/rules";
import type {
  OvertimeApprovalData,
  OvertimeFilters,
  OvertimeRequest,
} from "@/lib/overtime/types";

type Tab = "pending" | "history";

const DEFAULT_FILTERS: OvertimeFilters = {
  q: "",
  department: "Semua",
  dayType: "Semua",
  from: "",
  to: "",
};

export function OvertimeApprovalView({
  initialData,
}: {
  initialData: OvertimeApprovalData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("pending");
  const [filters, setFilters] = useState<OvertimeFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allRequests = useMemo(
    () => [...data.pending, ...data.history, ...data.active],
    [data]
  );
  const stats = useMemo(
    () => buildOvertimeApprovalStats(allRequests, data.todayIso),
    [allRequests, data.todayIso]
  );
  const departments = useMemo(
    () => overtimeDepartmentOptions(allRequests),
    [allRequests]
  );
  const pendingRows = useMemo(
    () => filterOvertimeRequests(data.pending, filters),
    [data.pending, filters]
  );
  const historyRows = useMemo(
    () => filterOvertimeRequests(data.history, filters),
    [data.history, filters]
  );
  const selected =
    [...data.pending, ...data.history].find(
      (request) => request.id === selectedId
    ) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/overtime/approvals", {
        cache: "no-store",
      });
      const body = (await response
        .json()
        .catch(() => null)) as (OvertimeApprovalData & { error?: string }) | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat persetujuan lembur");
      }
      setData(body);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Gagal memuat persetujuan lembur"
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const setFilter = <K extends keyof OvertimeFilters>(
    key: K,
    value: OvertimeFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.department !== "Semua" ||
    filters.dayType !== "Semua" ||
    filters.from !== "" ||
    filters.to !== "";

  const columns: DataTableColumn<OvertimeRequest>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "22%",
      render: (request) => (
        <TwoLineCell
          primary={request.employeeName}
          secondary={`${request.employeeDepartment} · ${request.employeeId}`}
        />
      ),
    },
    {
      key: "date",
      label: "Tanggal",
      width: "16%",
      render: (request) => (
        <span className="text-[13px]">{formatDateID(request.requestDate)}</span>
      ),
    },
    {
      key: "day",
      label: "Jenis Hari",
      width: "18%",
      render: (request) => <OvertimeDayTag dayType={request.dayType} />,
    },
    {
      key: "time",
      label: "Jam",
      width: "16%",
      render: (request) => (
        <TwoLineCell
          primary={`${request.startTime}–${request.endTime}`}
          secondary={`Diajukan ${overtimeHoursLabel(
            request.requestedMinutes
          )}`}
        />
      ),
    },
    {
      key: "approved",
      label: "Disetujui",
      width: "16%",
      render: (request) => <OvertimeApprovedCell request={request} />,
    },
    {
      key: "status",
      label: "Status",
      width: "12%",
      render: (request) => <OvertimeStatusTag status={request.status} />,
    },
    {
      key: "actions",
      label: "Aksi",
      width: "14%",
      render: (request) => (
        <button
          type="button"
          className="btn btn-g !py-1 !px-2 !text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(request.id);
          }}
        >
          Detail
        </button>
      ),
    },
  ];

  const rows = tab === "pending" ? pendingRows : historyRows;

  return (
    <>
      <PageHead
        title="Lembur"
        subtitle="Tinjau pengajuan lembur, atur jam disetujui, dan pantau ekuivalensinya."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: "Menunggu",
            value: stats.pending,
            hint: "perlu keputusan",
          },
          {
            label: "Jam Disetujui",
            value: overtimeHoursLabel(stats.monthlyApprovedMinutes),
            hint: "bulan ini",
          },
          {
            label: "Jam Ekuivalen",
            value: overtimeHoursLabel(stats.monthlyEquivalentMinutes),
            hint: "bulan ini",
          },
          {
            label: "Lembur Terbanyak",
            value: stats.topEmployeeName ?? "—",
            hint:
              stats.topEmployeeName !== null
                ? `${overtimeHoursLabel(stats.topEmployeeMinutes)} bulan ini`
                : "belum ada lembur disetujui",
          },
        ].map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[22px] font-bold tracking-tight mt-1 break-words">
              {card.value}
            </div>
            <div className="text-[10px] sub">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["pending", `Menunggu (${data.pending.length})`],
            ["history", "Riwayat Keputusan"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn ${tab === value ? "btn-p" : "btn-g"} !py-1.5 !px-3`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
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
          value={filters.dayType}
          onChange={(event) => setFilter("dayType", event.target.value)}
          aria-label="Filter jenis hari"
        >
          <option value="Semua">Semua jenis hari</option>
          <option value="workday">Hari kerja</option>
          <option value="restday">Hari istirahat</option>
          <option value="holiday">Libur nasional/cuti bersama</option>
        </select>

        <input
          type="date"
          className="inp !w-auto"
          value={filters.from}
          onChange={(event) => setFilter("from", event.target.value)}
          aria-label="Tanggal mulai filter"
        />
        <input
          type="date"
          className="inp !w-auto"
          value={filters.to}
          onChange={(event) => setFilter("to", event.target.value)}
          aria-label="Tanggal selesai filter"
        />

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

      <DataTable
        ariaLabel={
          tab === "pending"
            ? "Antrean persetujuan lembur"
            : "Riwayat keputusan lembur"
        }
        columns={columns}
        rows={rows}
        rowKey={(request) => request.id}
        rowLabel={(request) =>
          `Buka detail lembur ${request.employeeName} ${formatDateID(
            request.requestDate
          )}`
        }
        onRowActivate={(request) => setSelectedId(request.id)}
        rowAction={{
          ariaLabel: (request) =>
            `Lihat detail lembur ${request.employeeName}`,
          label: "Lihat detail",
        }}
        empty={
          tab === "pending"
            ? "Tidak ada pengajuan lembur yang menunggu."
            : "Belum ada riwayat keputusan lembur."
        }
        minWidth={980}
      />

      <OvertimeDetailDrawer
        request={selected}
        mode="staff"
        activeRequests={data.active}
        onClose={() => setSelectedId(null)}
        onMutated={(message) => {
          setSelectedId(null);
          toast(message);
          void refresh();
        }}
      />
    </>
  );
}
