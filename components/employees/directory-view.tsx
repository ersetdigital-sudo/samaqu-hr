"use client";

import { useCallback, useMemo, useState } from "react";
import { EmployeeDrawer } from "@/components/employees/employee-drawer";
import { EmployeeModal } from "@/components/employees/employee-modal";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import {
  DataTable,
  EllipsisText,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { useRecruitment } from "@/components/recruitment-provider";
import { formatIsoDateID } from "@/lib/employees/format";
import {
  DEFAULT_FILTERS,
  buildDirectoryStats,
  filterEmployees,
  uniqueOptions,
  type DirectoryFilters,
  type DirectorySort,
} from "@/lib/employees/query";
import {
  EMPLOYEE_STATUSES,
  type EmployeeDetail,
  type EmployeeListResponse,
  type EmployeeSummary,
} from "@/lib/employees/types";

const SORT_OPTIONS: { value: DirectorySort; label: string }[] = [
  { value: "name-asc", label: "Nama A–Z" },
  { value: "name-desc", label: "Nama Z–A" },
  { value: "joined-desc", label: "Bergabung terbaru" },
  { value: "joined-asc", label: "Bergabung terlama" },
];

export function DirectoryView({
  initialEmployees,
  initialNextId,
}: {
  initialEmployees: EmployeeSummary[];
  initialNextId: string;
}) {
  const { toast } = useRecruitment();
  const [rows, setRows] = useState<EmployeeSummary[]>(initialEmployees);
  const [nextId, setNextId] = useState(initialNextId);
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_FILTERS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => buildDirectoryStats(rows), [rows]);
  const result = useMemo(() => filterEmployees(rows, filters), [rows, filters]);
  const departments = useMemo(() => uniqueOptions(rows, "department"), [rows]);
  const locations = useMemo(() => uniqueOptions(rows, "location"), [rows]);
  const employmentTypes = useMemo(
    () => uniqueOptions(rows, "employmentType"),
    [rows],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/employees", { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal memuat direktori karyawan");
    const data = (await response.json()) as EmployeeListResponse;
    setRows(data.employees);
    setNextId(data.nextId);
  }, []);

  const reload = useCallback(
    async (message?: string) => {
      setBusy(true);
      try {
        await refresh();
        if (message) toast(message);
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Gagal memuat data karyawan",
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast],
  );

  const setFilter = <K extends keyof DirectoryFilters>(
    key: K,
    value: DirectoryFilters[K],
  ) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.department !== "Semua" ||
    filters.status !== "Semua" ||
    filters.location !== "Semua" ||
    filters.employmentType !== "Semua";

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSaved = async (message: string) => {
    setFormOpen(false);
    setEditing(null);
    await reload(message);
  };

  const columns: DataTableColumn<EmployeeSummary>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "26%",
      render: (employee) => (
        <TwoLineCell primary={employee.fullName} secondary={employee.id} />
      ),
    },
    {
      key: "position",
      label: "Jabatan",
      width: "24%",
      render: (employee) => (
        <TwoLineCell
          primary={employee.position}
          secondary={employee.department}
        />
      ),
    },
    {
      key: "employment",
      label: "Hubungan Kerja",
      width: "17%",
      render: (employee) => <EllipsisText text={employee.employmentType} />,
    },
    {
      key: "status",
      label: "Status",
      width: "16%",
      render: (employee) => (
        <span className={`tag ${employeeStatusTone(employee.status)}`}>
          {employee.status}
        </span>
      ),
    },
    {
      key: "joined",
      label: "Tanggal Masuk",
      width: "17%",
      render: (employee) => (
        <EllipsisText text={formatIsoDateID(employee.joinedAt)} />
      ),
    },
  ];

  const summary = [
    {
      label: "Karyawan Aktif",
      value: stats.totalActive,
      hint: "status Aktif",
      highlight: false,
    },
    {
      label: "Karyawan Baru",
      value: stats.newLast30Days,
      hint: "30 hari terakhir",
      highlight: false,
    },
    {
      label: "Masa Probation",
      value: stats.probation,
      hint: "menunggu evaluasi",
      highlight: true,
    },
    {
      label: "Nonaktif",
      value: stats.inactive,
      hint: "tidak aktif bekerja",
      highlight: false,
    },
  ];

  return (
    <>
      <PageHead
        title="Direktori Karyawan"
        subtitle="Data induk karyawan. Employee ID menjadi identitas utama lintas modul HRIS."
      >
        <button
          className="btn btn-g"
          onClick={() => void reload()}
          disabled={busy}
        >
          {busy ? "Memuat…" : "Muat ulang"}
        </button>
        <button className="btn btn-p" onClick={openCreate}>
          <Icon name="plus" /> Tambah Karyawan
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {summary.map((card) => (
          <div
            key={card.label}
            className={`card p-5 ${card.highlight ? "ring-1" : ""}`}
            style={
              card.highlight
                ? { boxShadow: "0 0 0 1px var(--pink-100)" }
                : undefined
            }
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
            placeholder="Cari nama, Employee ID, atau jabatan…"
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
          />
          <Icon name="search" className="search-icon" />
        </div>

        <select
          className="inp !w-auto"
          value={filters.department}
          onChange={(event) => setFilter("department", event.target.value)}
        >
          {["Semua", ...departments].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.status}
          onChange={(event) => setFilter("status", event.target.value)}
        >
          {["Semua", ...EMPLOYEE_STATUSES].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.location}
          onChange={(event) => setFilter("location", event.target.value)}
        >
          {["Semua", ...locations].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.employmentType}
          onChange={(event) => setFilter("employmentType", event.target.value)}
        >
          {["Semua", ...employmentTypes].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.sort}
          onChange={(event) =>
            setFilter("sort", event.target.value as DirectorySort)
          }
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            className="btn btn-g"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Reset filter
          </button>
        )}
      </div>

      <DataTable
        ariaLabel="Daftar karyawan"
        columns={columns}
        rows={result.rows}
        rowKey={(employee) => employee.id}
        rowLabel={(employee) => `Buka detail ${employee.fullName}`}
        onRowActivate={(employee) => setDetailId(employee.id)}
        rowAction={{
          ariaLabel: (employee) => `Lihat detail ${employee.fullName}`,
        }}
        empty="Tidak ada karyawan yang cocok dengan pencarian/filter."
      />

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        from={result.from}
        to={result.to}
        total={result.total}
        unit="karyawan"
        onChange={(page) => setFilter("page", page)}
      />

      <EmployeeDrawer
        employeeId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(detail) => {
          setDetailId(null);
          setEditing(detail);
          setFormOpen(true);
        }}
        onChanged={(message) => void reload(message)}
      />

      <EmployeeModal
        open={formOpen}
        initial={editing}
        nextId={nextId}
        managers={rows}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={(message) => void handleSaved(message)}
      />
    </>
  );
}
