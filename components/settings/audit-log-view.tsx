"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/ui/pagination";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateTimeID } from "@/lib/datetime";
import {
  AUDIT_PAGE_SIZE,
  auditModuleOptions,
  auditPagination,
} from "@/lib/audit/rules";
import type {
  AuditEvent,
  AuditFilters,
  AuditResult,
} from "@/lib/audit/types";

const EMPTY_FILTERS: AuditFilters = {
  module: "",
  from: "",
  to: "",
  actor: "",
  q: "",
};

export function AuditLogView({
  initialData,
  isAdmin,
}: {
  initialData: AuditResult;
  isAdmin: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const modules = useMemo(() => auditModuleOptions(isAdmin), [isAdmin]);

  const load = async (
    nextPage: number,
    activeFilters: AuditFilters = filters
  ) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (activeFilters.module) params.set("module", activeFilters.module);
      if (activeFilters.from) params.set("from", activeFilters.from);
      if (activeFilters.to) params.set("to", activeFilters.to);
      if (activeFilters.actor) params.set("actor", activeFilters.actor);
      if (activeFilters.q) params.set("q", activeFilters.q);
      const response = await fetch(`/api/settings/audit?${params}`, {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (AuditResult & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat audit log");
      }
      setData({ total: body.total, items: body.items });
      setPage(nextPage);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Gagal memuat audit log"
      );
    } finally {
      setLoading(false);
    }
  };

  const setFilter = <K extends keyof AuditFilters>(
    key: K,
    value: AuditFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const pagination = auditPagination(data.total, page);

  const columns: DataTableColumn<AuditEvent>[] = [
    {
      key: "time",
      label: "Waktu",
      width: "18%",
      render: (row) => (
        <span className="text-[12px] whitespace-nowrap">
          {formatDateTimeID(row.occurredAt)}
        </span>
      ),
    },
    {
      key: "module",
      label: "Modul",
      width: "14%",
      render: (row) => <span className="tag t-mute">{row.moduleLabel}</span>,
    },
    {
      key: "action",
      label: "Aksi",
      width: "26%",
      render: (row) => <span className="text-[13px]">{row.actionLabel}</span>,
    },
    {
      key: "object",
      label: "Objek",
      width: "26%",
      render: (row) => <span className="text-[13px]">{row.objectLabel}</span>,
    },
    {
      key: "actor",
      label: "Pelaku",
      width: "16%",
      render: (row) => <span className="text-[13px]">{row.actorName}</span>,
    },
  ];

  return (
    <>
      <PageHead
        title="Audit Log"
        subtitle="Riwayat perubahan lintas modul. Hanya nama field yang berubah untuk data pelamar; nilai sensitif tidak ditampilkan."
      >
        <Link className="btn btn-g" href="/settings/umum">
          Kembali
        </Link>
      </PageHead>

      <form
        className="card p-4 mb-4"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1);
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="lbl">Modul</span>
            <select
              className="inp !w-auto"
              value={filters.module}
              onChange={(event) => setFilter("module", event.target.value)}
            >
              <option value="">Semua modul</option>
              {modules.map((option) => (
                <option value={option.key} key={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Dari tanggal</span>
            <input
              type="date"
              className="inp !w-auto"
              value={filters.from}
              onChange={(event) => setFilter("from", event.target.value)}
            />
          </label>
          <label>
            <span className="lbl">Sampai tanggal</span>
            <input
              type="date"
              className="inp !w-auto"
              value={filters.to}
              onChange={(event) => setFilter("to", event.target.value)}
            />
          </label>
          <label>
            <span className="lbl">Pelaku</span>
            <input
              className="inp !w-44"
              placeholder="Cari nama pelaku"
              value={filters.actor}
              onChange={(event) => setFilter("actor", event.target.value)}
            />
          </label>
          <label>
            <span className="lbl">Pencarian</span>
            <input
              className="inp !w-56"
              placeholder="Aksi, objek, modul"
              value={filters.q}
              onChange={(event) => setFilter("q", event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-p" disabled={loading}>
            {loading ? "Memuat…" : "Terapkan"}
          </button>
          <button
            type="button"
            className="btn btn-g"
            disabled={loading}
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              void load(1, EMPTY_FILTERS);
            }}
          >
            Reset
          </button>
        </div>
        <div className="text-[11px] sub mt-3">
          {data.total} peristiwa tercatat · {AUDIT_PAGE_SIZE} per halaman.
          Sumber khusus Admin tidak dihitung untuk HR Manager.
        </div>
      </form>

      {error && <div className="tag t-bad w-full justify-center mb-4">{error}</div>}

      <div className="card p-5">
        <DataTable
          ariaLabel="Audit log"
          columns={columns}
          rows={data.items}
          rowKey={(row) => `${row.occurredAt}-${row.moduleKey}-${row.actionLabel}-${row.objectLabel}-${row.actorName}`}
          empty={
            loading
              ? "Memuat audit log…"
              : "Tidak ada peristiwa yang cocok dengan filter."
          }
          minWidth={980}
        />

        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          from={pagination.from}
          to={pagination.to}
          total={data.total}
          unit="peristiwa"
          onChange={(nextPage) => void load(nextPage)}
        />
      </div>
    </>
  );
}
