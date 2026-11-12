"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { PositionChangeDialog } from "@/components/position-history/position-change-dialog";
import { PositionHistoryDrawer } from "@/components/position-history/position-history-drawer";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { DateFilterInput } from "@/components/ui/date-filter";
import { Pagination } from "@/components/ui/pagination";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import {
  buildPositionHistoryStats,
  DEFAULT_POSITION_HISTORY_FILTERS,
  filterPositionHistory,
  POSITION_CHANGE_TYPE_FILTERS,
  positionChangeTone,
  positionDepartmentOptions,
  type PositionHistoryFilters,
} from "@/lib/position-history/query";
import { positionChangeDiff } from "@/lib/position-history/rules";
import type {
  PositionEmployeeOption,
  PositionHistoryEntry,
} from "@/lib/position-history/types";

type PositionHistoryResponse = {
  history?: PositionHistoryEntry[];
  employees?: PositionEmployeeOption[];
  error?: string;
};

const managerNameFor =
  (entry: PositionHistoryEntry) => (id: string | null) => {
    if (!id) return "—";
    if (id === entry.oldManagerId) return entry.oldManagerName ?? id;
    if (id === entry.newManagerId) return entry.newManagerName ?? id;
    return id;
  };

export function PositionHistoryView({
  initialHistory,
  initialEmployees,
  todayIso,
}: {
  initialHistory: PositionHistoryEntry[];
  initialEmployees: PositionEmployeeOption[];
  todayIso: string;
}) {
  const { toast } = useRecruitment();
  const [history, setHistory] = useState(initialHistory);
  const [employees, setEmployees] =
    useState<PositionEmployeeOption[]>(initialEmployees);
  const [filters, setFilters] = useState<PositionHistoryFilters>(
    DEFAULT_POSITION_HISTORY_FILTERS
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] =
    useState<PositionHistoryEntry | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHistory(initialHistory);
    setEmployees(initialEmployees);
  }, [initialHistory, initialEmployees]);

  const stats = buildPositionHistoryStats(history, todayIso);
  const result = filterPositionHistory(history, filters);
  const departments = positionDepartmentOptions(history);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/position-history", {
      cache: "no-store",
    });
    const body = (await response
      .json()
      .catch(() => null)) as PositionHistoryResponse | null;
    if (!response.ok || !body?.history || !body.employees) {
      throw new Error(body?.error ?? "Gagal memuat riwayat jabatan");
    }
    setHistory(body.history);
    setEmployees(body.employees);
  }, []);

  const reload = useCallback(
    async (message?: string) => {
      setBusy(true);
      try {
        await refresh();
        if (message) toast(message);
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat riwayat jabatan"
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast]
  );

  const setFilter = <K extends keyof PositionHistoryFilters>(
    key: K,
    value: PositionHistoryFilters[K]
  ) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.changeType !== "Semua" ||
    filters.department !== "Semua" ||
    filters.from !== "" ||
    filters.to !== "";

  const columns: DataTableColumn<PositionHistoryEntry>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "24%",
      render: (entry) => (
        <TwoLineCell
          primary={entry.employeeName}
          secondary={entry.employeeId}
        />
      ),
    },
    {
      key: "type",
      label: "Jenis",
      width: "12%",
      render: (entry) => (
        <span className={`tag ${positionChangeTone(entry.changeType)}`}>
          {entry.changeType}
        </span>
      ),
    },
    {
      key: "effective",
      label: "Efektif",
      width: "14%",
      render: (entry) => (
        <span className="text-[13px]">
          {formatDateID(entry.effectiveDate)}
        </span>
      ),
    },
    {
      key: "changes",
      label: "Perubahan",
      width: "31%",
      render: (entry) => {
        const diffs = positionChangeDiff(entry, managerNameFor(entry));
        if (diffs.length === 0) {
          return <span className="sub text-[12px]">—</span>;
        }
        const [first, ...rest] = diffs;
        return (
          <TwoLineCell
            primary={`${first.label}: ${first.before} → ${first.after}`}
            secondary={
              rest.length > 0
                ? `+${rest.length} perubahan lain`
                : entry.reason
            }
          />
        );
      },
    },
    {
      key: "recorded",
      label: "Dicatat",
      width: "19%",
      render: (entry) => (
        <TwoLineCell
          primary={formatDateTimeID(entry.recordedAt)}
          secondary={entry.recordedByName ?? "HR"}
        />
      ),
    },
  ];

  const summary = [
    {
      label: "Promosi",
      value: stats.promotions,
      hint: "90 hari terakhir",
      highlight: true,
    },
    {
      label: "Mutasi",
      value: stats.mutations,
      hint: "90 hari terakhir",
      highlight: false,
    },
    {
      label: "Demosi",
      value: stats.demotions,
      hint: "90 hari terakhir",
      highlight: false,
    },
  ];

  return (
    <>
      <PageHead
        title="Mutasi & Promosi"
        subtitle="Catat perubahan jabatan, departemen, atasan langsung, dan lokasi kerja karyawan."
      >
        <button
          className="btn btn-g"
          onClick={() => void reload()}
          disabled={busy}
        >
          {busy ? "Memuat…" : "Muat ulang"}
        </button>
        <button className="btn btn-p" onClick={() => setDialogOpen(true)}>
          <Icon name="plus" /> Catat Perubahan
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {summary.map((card) => (
          <div
            className={`card p-5 ${card.highlight ? "ring-1" : ""}`}
            style={
              card.highlight
                ? { boxShadow: "0 0 0 1px var(--pink-100)" }
                : undefined
            }
            key={card.label}
          >
            <div className="text-[12px] sub font-semibold">{card.label}</div>
            <div className="text-[28px] font-bold tracking-tight mt-1">
              {card.value}
            </div>
            <div className="text-[12px] sub mt-1">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full md:w-72">
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
          value={filters.changeType}
          onChange={(event) =>
            setFilter(
              "changeType",
              event.target.value as PositionHistoryFilters["changeType"]
            )
          }
          aria-label="Filter jenis perubahan"
        >
          {POSITION_CHANGE_TYPE_FILTERS.map((value) => (
            <option key={value}>{value}</option>
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

        <div className="flex items-center gap-2">
          <DateFilterInput
            value={filters.from}
            onChange={(value) => setFilter("from", value)}
            ariaLabel="Efektif dari tanggal"
          />
          <span className="text-[12px] sub">s/d</span>
          <DateFilterInput
            value={filters.to}
            onChange={(value) => setFilter("to", value)}
            ariaLabel="Efektif sampai tanggal"
          />
        </div>

        {filtersActive && (
          <button
            className="btn btn-g"
            onClick={() => setFilters(DEFAULT_POSITION_HISTORY_FILTERS)}
          >
            Reset filter
          </button>
        )}
      </div>

      <DataTable
        ariaLabel="Daftar riwayat perubahan posisi"
        columns={columns}
        rows={result.rows}
        rowKey={(entry) => String(entry.id)}
        rowLabel={(entry) => `Buka detail perubahan ${entry.employeeName}`}
        onRowActivate={(entry) => setSelectedEntry(entry)}
        rowAction={{
          ariaLabel: (entry) =>
            `Lihat detail perubahan ${entry.employeeName}`,
        }}
        empty={
          history.length === 0
            ? "Belum ada perubahan posisi yang tercatat."
            : "Tidak ada riwayat yang cocok dengan pencarian/filter."
        }
      />

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        from={result.from}
        to={result.to}
        total={result.total}
        unit="perubahan"
        onChange={(page) => setFilter("page", page)}
      />

      {history.length === 0 && (
        <div className="sub text-[12px] mt-3">
          Perubahan yang dicatat lewat tombol Catat Perubahan akan muncul di
          sini.
        </div>
      )}

      <PositionHistoryDrawer
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />

      <PositionChangeDialog
        open={dialogOpen}
        employees={employees}
        todayIso={todayIso}
        onClose={() => setDialogOpen(false)}
        onSaved={(message) => {
          setDialogOpen(false);
          void reload(message);
        }}
      />
    </>
  );
}
