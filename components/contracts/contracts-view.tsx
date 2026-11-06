"use client";

import { useCallback, useMemo, useState } from "react";
import { ContractDrawer } from "@/components/contracts/contract-drawer";
import { ContractModal } from "@/components/contracts/contract-modal";
import type { ContractModalState } from "@/components/contracts/contract-modal-state";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  EllipsisText,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  CONTRACT_DISPLAY_STATUSES,
  contractStatusTone,
} from "@/lib/contracts/constants";
import {
  CONTRACT_SORT_LABELS,
  DEFAULT_CONTRACT_FILTERS,
  buildContractStats,
  filterContracts,
  uniqueContractValues,
  type ContractFilters,
  type ContractSort,
} from "@/lib/contracts/query";
import type {
  Contract,
  ContractEmployeeRef,
  ContractListResponse,
  ContractSummary,
} from "@/lib/contracts/types";
import { formatIsoDateID } from "@/lib/employees/format";
import { EMPLOYMENT_TYPES } from "@/lib/employees/types";

export function ContractsView({
  initialContracts,
  initialEmployees,
}: {
  initialContracts: ContractSummary[];
  initialEmployees: ContractEmployeeRef[];
}) {
  const { toast } = useRecruitment();
  const [contracts, setContracts] = useState(initialContracts);
  const [employees, setEmployees] = useState(initialEmployees);
  const [filters, setFilters] = useState<ContractFilters>(
    DEFAULT_CONTRACT_FILTERS,
  );
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [modal, setModal] = useState<ContractModalState | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(
    () => buildContractStats(contracts, employees),
    [contracts, employees],
  );
  const result = useMemo(
    () => filterContracts(contracts, filters),
    [contracts, filters],
  );
  const departments = useMemo(
    () => uniqueContractValues(contracts, "department"),
    [contracts],
  );
  const types = useMemo(
    () => uniqueContractValues(contracts, "employmentType"),
    [contracts],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/contracts", { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal memuat data kontrak");
    const data = (await response.json()) as ContractListResponse;
    setContracts(data.contracts);
    setEmployees(data.employees);
  }, []);

  const reload = useCallback(
    async (message?: string) => {
      setBusy(true);
      try {
        await refresh();
        if (message) toast(message);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Gagal memuat kontrak");
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast],
  );

  const setFilter = <K extends keyof ContractFilters>(
    key: K,
    value: ContractFilters[K],
  ) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.status !== "Semua" ||
    filters.employmentType !== "Semua" ||
    filters.department !== "Semua" ||
    filters.endFrom !== "" ||
    filters.endTo !== "";

  const endContract = async (contract: Contract): Promise<boolean> => {
    const confirmed = window.confirm(
      `Akhiri kontrak ${contract.contractNumber}?`,
    );
    if (!confirmed) return false;

    try {
      const response = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? "Gagal mengakhiri kontrak");
      await reload(`Kontrak ${contract.contractNumber} diakhiri`);
      setDetailEmployeeId(contract.employeeId);
      return true;
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Gagal mengakhiri kontrak",
      );
      return false;
    }
  };

  const columns: DataTableColumn<ContractSummary>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "24%",
      render: (contract) => (
        <TwoLineCell
          primary={contract.employeeName}
          secondary={contract.employeeId}
        />
      ),
    },
    {
      key: "position",
      label: "Jabatan",
      width: "22%",
      render: (contract) => (
        <TwoLineCell
          primary={contract.position}
          secondary={contract.department}
        />
      ),
    },
    {
      key: "number",
      label: "Kontrak",
      width: "15%",
      render: (contract) => <EllipsisText text={contract.contractNumber} />,
    },
    {
      key: "period",
      label: "Periode",
      width: "19%",
      render: (contract) => {
        const period = `${formatIsoDateID(contract.startDate)} – ${
          contract.endDate ? formatIsoDateID(contract.endDate) : "Tanpa batas"
        }`;
        return <EllipsisText text={period} />;
      },
    },
    {
      key: "status",
      label: "Status",
      width: "20%",
      render: (contract) => (
        <span className={`tag ${contractStatusTone(contract.displayStatus)}`}>
          {contract.displayStatus}
        </span>
      ),
    },
  ];

  const summary = [
    {
      label: "Kontrak Aktif",
      value: stats.active,
      hint: "termasuk akan berakhir",
    },
    {
      label: "Akan Berakhir",
      value: stats.expiring30,
      hint: "dalam 30 hari",
      highlight: true,
    },
    {
      label: "Pantauan 90 hari",
      value: stats.expiring90,
      hint: "perlu persiapan",
    },
    { label: "Sudah Berakhir", value: stats.ended, hint: "tidak aktif" },
  ];

  return (
    <>
      <PageHead
        title="Kontrak & Masa Kerja"
        subtitle="Riwayat kontrak per karyawan. Data karyawan mengikuti Direktori lewat Employee ID."
      >
        <button
          className="btn btn-g"
          onClick={() => void reload()}
          disabled={busy}
        >
          {busy ? "Memuat…" : "Muat ulang"}
        </button>
        <button
          className="btn btn-p"
          onClick={() =>
            setModal({ mode: "create", contract: null, employeeId: null })
          }
        >
          <Icon name="plus" /> Tambah Kontrak
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
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

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-semibold sub">
          Karyawan per hubungan kerja
        </span>
        {EMPLOYMENT_TYPES.map((type) => (
          <span className="tag t-mute" key={type}>
            {type}
            <b>{stats.employmentCounts[type]}</b>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full md:w-72">
          <input
            className="inp inp-search"
            placeholder="Cari nama, Employee ID, atau nomor kontrak…"
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
          />
          <Icon name="search" className="search-icon" />
        </div>

        <select
          className="inp !w-auto"
          value={filters.status}
          onChange={(event) => setFilter("status", event.target.value)}
        >
          {["Semua", ...CONTRACT_DISPLAY_STATUSES].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.employmentType}
          onChange={(event) => setFilter("employmentType", event.target.value)}
        >
          {["Semua", ...new Set([...types, ...EMPLOYMENT_TYPES])].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>

        <select
          className="inp !w-auto"
          value={filters.department}
          onChange={(event) => setFilter("department", event.target.value)}
        >
          {["Semua", ...departments].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            className="inp !w-auto"
            type="date"
            value={filters.endFrom}
            onChange={(event) => setFilter("endFrom", event.target.value)}
            aria-label="Berakhir dari tanggal"
          />
          <span className="text-[12px] sub">s/d</span>
          <input
            className="inp !w-auto"
            type="date"
            value={filters.endTo}
            onChange={(event) => setFilter("endTo", event.target.value)}
            aria-label="Berakhir sampai tanggal"
          />
        </div>

        <select
          className="inp !w-auto"
          value={filters.sort}
          onChange={(event) =>
            setFilter("sort", event.target.value as ContractSort)
          }
        >
          {CONTRACT_SORT_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            className="btn btn-g"
            onClick={() => setFilters(DEFAULT_CONTRACT_FILTERS)}
          >
            Reset filter
          </button>
        )}
      </div>

      <DataTable
        ariaLabel="Daftar kontrak"
        columns={columns}
        rows={result.rows}
        rowKey={(contract) => contract.id}
        rowLabel={(contract) => `Buka detail kontrak ${contract.employeeName}`}
        onRowActivate={(contract) => setDetailEmployeeId(contract.employeeId)}
        empty="Tidak ada kontrak yang cocok dengan pencarian/filter."
      />

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        from={result.from}
        to={result.to}
        total={result.total}
        unit="kontrak"
        onChange={(page) => setFilter("page", page)}
      />

      <ContractDrawer
        employeeId={detailEmployeeId}
        onClose={() => setDetailEmployeeId(null)}
        onAdd={(employeeId) =>
          setModal({ mode: "create", contract: null, employeeId })
        }
        onEdit={(contract) =>
          setModal({ mode: "edit", contract, employeeId: contract.employeeId })
        }
        onRenew={(contract) =>
          setModal({ mode: "renew", contract, employeeId: contract.employeeId })
        }
        onEnd={(contract) => endContract(contract)}
        onChanged={(message) => void reload(message)}
      />

      <ContractModal
        state={modal}
        employees={employees}
        onClose={() => setModal(null)}
        onSaved={(message) => {
          setModal(null);
          void reload(message);
        }}
      />

      {contracts.length === 0 && (
        <div className="sub text-[12px] mt-3">
          Belum ada kontrak. Tambahkan kontrak pertama untuk karyawan dari
          Direktori.
        </div>
      )}
    </>
  );
}
