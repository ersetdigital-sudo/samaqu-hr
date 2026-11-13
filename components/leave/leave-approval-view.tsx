"use client";

import { useCallback, useMemo, useState } from "react";
import { LeaveCalendar } from "@/components/leave/leave-calendar";
import { LeaveRequestDetailDrawer } from "@/components/leave/leave-request-detail-drawer";
import { LeaveStatusTag } from "@/components/leave/leave-status-tag";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import {
  buildLeaveApprovalStats,
  DEFAULT_LEAVE_APPROVAL_FILTERS,
  filterLeaveRequests,
  leaveDepartmentOptions,
  teamOverlapsFor,
  type LeaveApprovalFilters,
} from "@/lib/leave/query";
import { leaveCategoryLabel } from "@/lib/leave/rules";
import type {
  LeaveApprovalData,
  LeaveRequest,
} from "@/lib/leave/types";

type Tab = "pending" | "history" | "calendar";

export function LeaveApprovalView({
  initialData,
}: {
  initialData: LeaveApprovalData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("pending");
  const [filters, setFilters] = useState<LeaveApprovalFilters>(
    DEFAULT_LEAVE_APPROVAL_FILTERS
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stats = useMemo(
    () =>
      buildLeaveApprovalStats(
        data.pending,
        data.history,
        data.activeLeaves,
        data.todayIso
      ),
    [data]
  );

  const departments = useMemo(
    () => leaveDepartmentOptions(data.balances, data.activeLeaves),
    [data.balances, data.activeLeaves]
  );

  const pendingRows = useMemo(
    () => filterLeaveRequests(data.pending, filters),
    [data.pending, filters]
  );
  const historyRows = useMemo(
    () => filterLeaveRequests(data.history, filters),
    [data.history, filters]
  );

  const selected =
    [...data.pending, ...data.history].find(
      (request) => request.id === selectedId
    ) ?? null;

  const selectedBalance = selected
    ? data.balances.find(
        (balance) => balance.employeeId === selected.employeeId
      ) ?? null
    : null;

  const selectedOverlaps = selected
    ? teamOverlapsFor(selected, data.activeLeaves)
    : [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leave/approvals?year=${data.year}`, {
        cache: "no-store",
      });
      const body = (await response
        .json()
        .catch(() => null)) as (LeaveApprovalData & { error?: string }) | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat persetujuan cuti");
      }
      setData(body);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Gagal memuat persetujuan cuti"
      );
    } finally {
      setLoading(false);
    }
  }, [data.year, toast]);

  const setFilter = <K extends keyof LeaveApprovalFilters>(
    key: K,
    value: LeaveApprovalFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.type !== "Semua" ||
    filters.department !== "Semua" ||
    filters.from !== "" ||
    filters.to !== "";

  const columns: DataTableColumn<LeaveRequest>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "24%",
      render: (request) => (
        <TwoLineCell
          primary={request.employeeName}
          secondary={`${request.employeeDepartment} · ${request.employeeId}`}
        />
      ),
    },
    {
      key: "type",
      label: "Jenis",
      width: "20%",
      render: (request) => (
        <TwoLineCell
          primary={request.leaveTypeName}
          secondary={leaveCategoryLabel(request.leaveTypeCategory)}
        />
      ),
    },
    {
      key: "dates",
      label: "Tanggal",
      width: "24%",
      render: (request) => (
        <TwoLineCell
          primary={`${formatDateID(request.startDate)} – ${formatDateID(
            request.endDate
          )}`}
          secondary={`${request.daysCount} hari`}
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (request) => <LeaveStatusTag status={request.status} />,
    },
    {
      key: "actions",
      label: "Aksi",
      width: "18%",
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
        title="Persetujuan Cuti"
        subtitle="Tinjau pengajuan cuti dan izin, lihat saldo serta jadwal tim."
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
          { label: "Menunggu", value: stats.pending, hint: "perlu keputusan" },
          {
            label: "Cuti Hari Ini",
            value: stats.onLeaveToday,
            hint: "karyawan disetujui",
          },
          {
            label: "Disetujui Bulan Ini",
            value: stats.approvedThisMonth,
            hint: "pengajuan",
          },
          {
            label: "Ditolak Bulan Ini",
            value: stats.rejectedThisMonth,
            hint: "pengajuan",
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

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["pending", `Menunggu (${data.pending.length})`],
            ["history", "Riwayat Keputusan"],
            ["calendar", "Kalender Cuti"],
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

      {tab === "calendar" ? (
        <LeaveCalendar
          initialMonth={data.todayIso.slice(0, 7)}
          todayIso={data.todayIso}
        />
      ) : (
        <>
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
              value={filters.type}
              onChange={(event) => setFilter("type", event.target.value)}
              aria-label="Filter jenis cuti"
            >
              <option value="Semua">Semua jenis</option>
              {data.types.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </select>

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
                onClick={() => setFilters(DEFAULT_LEAVE_APPROVAL_FILTERS)}
              >
                Reset filter
              </button>
            )}
          </div>

          <DataTable
            ariaLabel={
              tab === "pending"
                ? "Antrean persetujuan cuti"
                : "Riwayat keputusan cuti"
            }
            columns={columns}
            rows={rows}
            rowKey={(request) => request.id}
            rowLabel={(request) =>
              `Buka detail ${request.leaveTypeName} ${request.employeeName}`
            }
            onRowActivate={(request) => setSelectedId(request.id)}
            empty={
              tab === "pending"
                ? "Tidak ada pengajuan yang menunggu."
                : "Belum ada riwayat keputusan."
            }
            minWidth={780}
          />
        </>
      )}

      <LeaveRequestDetailDrawer
        request={selected}
        mode="staff"
        balance={selectedBalance}
        todayIso={data.todayIso}
        teamOverlaps={selectedOverlaps}
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
