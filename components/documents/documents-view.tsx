"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentsDrawer } from "@/components/documents/documents-drawer";
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
import { formatDateID } from "@/lib/datetime";
import {
  buildDocumentStats,
  DEFAULT_DOCUMENT_FILTERS,
  DOCUMENT_SORT_LABELS,
  DOCUMENT_STATUS_FILTERS,
  DOCUMENT_TYPE_FILTERS,
  filterDocuments,
  formatFileSize,
  type DocumentFilters,
  type DocumentSort,
} from "@/lib/documents/query";
import {
  documentExpiryStatus,
  documentStatusTone,
} from "@/lib/documents/status";
import type {
  DocumentListResponse,
  DocumentType,
  EmployeeDocument,
} from "@/lib/documents/types";

export function DocumentsView({
  initialDocuments,
  todayIso,
  initialEmployeeId = null,
}: {
  initialDocuments: EmployeeDocument[];
  todayIso: string;
  initialEmployeeId?: string | null;
}) {
  const { toast } = useRecruitment();
  const [documents, setDocuments] = useState(initialDocuments);
  const [filters, setFilters] = useState<DocumentFilters>(
    DEFAULT_DOCUMENT_FILTERS
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    initialEmployeeId
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialEmployeeId) setSelectedEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  const stats = useMemo(
    () => buildDocumentStats(documents, todayIso),
    [documents, todayIso]
  );
  const result = useMemo(
    () => filterDocuments(documents, filters, todayIso),
    [documents, filters, todayIso]
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/documents", { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal memuat daftar dokumen");
    const data = (await response.json()) as DocumentListResponse;
    setDocuments(data.documents);
  }, []);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      await refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Gagal memuat daftar dokumen"
      );
    } finally {
      setBusy(false);
    }
  }, [refresh, toast]);

  const setFilter = <K extends keyof DocumentFilters>(
    key: K,
    value: DocumentFilters[K]
  ) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? (value as number) : 1,
    }));

  const filtersActive =
    filters.q.trim() !== "" ||
    filters.docType !== "Semua" ||
    filters.status !== "Semua";

  const columns: DataTableColumn<EmployeeDocument>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "25%",
      render: (document) => (
        <TwoLineCell
          primary={document.employeeName}
          secondary={document.employeeId}
        />
      ),
    },
    {
      key: "type",
      label: "Jenis",
      width: "15%",
      render: (document) => <EllipsisText text={document.docType} />,
    },
    {
      key: "file",
      label: "Dokumen",
      width: "28%",
      render: (document) => (
        <TwoLineCell
          primary={document.title ?? document.fileName}
          secondary={`${document.fileName} · ${formatFileSize(document.fileSize)}`}
        />
      ),
    },
    {
      key: "validity",
      label: "Berlaku s/d",
      width: "18%",
      render: (document) => {
        const status = documentExpiryStatus(document.validUntil, todayIso);
        return (
          <span className="flex flex-col items-start gap-1">
            <span className="text-[13px]">
              {formatDateID(document.validUntil)}
            </span>
            {status && (
              <span className={`tag ${documentStatusTone(status)}`}>
                {status}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "uploaded",
      label: "Diunggah",
      width: "14%",
      render: (document) => (
        <EllipsisText text={formatDateID(document.uploadedAt)} />
      ),
    },
  ];

  const summary = [
    {
      label: "Total Dokumen",
      value: stats.total,
      hint: "tersimpan di semua karyawan",
      highlight: false,
    },
    {
      label: "Akan Habis",
      value: stats.expiring,
      hint: "sisa 30 hari atau kurang",
      highlight: true,
    },
    {
      label: "Kedaluwarsa",
      value: stats.expired,
      hint: "perlu diperbarui",
      highlight: false,
    },
  ];

  return (
    <>
      <PageHead
        title="Dokumen & Berkas"
        subtitle="Dokumen pribadi karyawan: KTP, KK, ijazah, sertifikat, dan surat lainnya."
      >
        <button
          className="btn btn-g"
          onClick={() => void reload()}
          disabled={busy}
        >
          {busy ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
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
            placeholder="Cari nama, Employee ID, atau dokumen…"
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
          />
          <Icon name="search" className="search-icon" />
        </div>

        <select
          className="inp !w-auto"
          value={filters.docType}
          onChange={(event) =>
            setFilter("docType", event.target.value as "Semua" | DocumentType)
          }
          aria-label="Filter jenis dokumen"
        >
          {DOCUMENT_TYPE_FILTERS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.status}
          onChange={(event) =>
            setFilter(
              "status",
              event.target.value as DocumentFilters["status"]
            )
          }
          aria-label="Filter status dokumen"
        >
          {DOCUMENT_STATUS_FILTERS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          className="inp !w-auto"
          value={filters.sort}
          onChange={(event) =>
            setFilter("sort", event.target.value as DocumentSort)
          }
          aria-label="Urutkan dokumen"
        >
          {DOCUMENT_SORT_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            className="btn btn-g"
            onClick={() => setFilters(DEFAULT_DOCUMENT_FILTERS)}
          >
            Reset filter
          </button>
        )}
      </div>

      <DataTable
        ariaLabel="Daftar dokumen karyawan"
        columns={columns}
        rows={result.rows}
        rowKey={(document) => document.id}
        rowLabel={(document) => `Buka dokumen ${document.employeeName}`}
        onRowActivate={(document) => setSelectedEmployeeId(document.employeeId)}
        rowAction={{
          ariaLabel: (document) =>
            `Lihat dokumen ${document.employeeName}`,
        }}
        empty={
          documents.length === 0
            ? "Belum ada dokumen. Buka detail karyawan di Direktori untuk mulai mengunggah."
            : "Tidak ada dokumen yang cocok dengan pencarian/filter."
        }
      />

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        from={result.from}
        to={result.to}
        total={result.total}
        unit="dokumen"
        onChange={(page) => setFilter("page", page)}
      />

      <DocumentsDrawer
        employeeId={selectedEmployeeId}
        todayIso={todayIso}
        onClose={() => {
          setSelectedEmployeeId(null);
          window.history.replaceState(null, "", "/employees/dokumen");
        }}
        onMutated={(message) => {
          toast(message);
          void refresh().catch(() => {});
        }}
      />
    </>
  );
}
