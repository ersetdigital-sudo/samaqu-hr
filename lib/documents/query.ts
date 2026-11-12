/** Filter, urutan, pagination, dan ringkasan daftar dokumen. */

import {
  documentExpiryStatus,
  type DocumentExpiryStatus,
} from "@/lib/documents/status";
import type {
  DocumentType,
  EmployeeDocument,
} from "@/lib/documents/types";
import { DOCUMENT_TYPES } from "@/lib/documents/types";

export type DocumentSort =
  | "uploaded-desc"
  | "uploaded-asc"
  | "expiry-asc"
  | "name-asc";

export type DocumentStatusFilter = "Semua" | DocumentExpiryStatus;

export type DocumentFilters = {
  q: string;
  docType: "Semua" | DocumentType;
  status: DocumentStatusFilter;
  sort: DocumentSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_DOCUMENT_FILTERS: DocumentFilters = {
  q: "",
  docType: "Semua",
  status: "Semua",
  sort: "uploaded-desc",
  page: 1,
  pageSize: 8,
};

export const DOCUMENT_SORT_LABELS: { value: DocumentSort; label: string }[] = [
  { value: "uploaded-desc", label: "Terbaru diunggah" },
  { value: "uploaded-asc", label: "Terlama diunggah" },
  { value: "expiry-asc", label: "Berlaku terdekat" },
  { value: "name-asc", label: "Nama karyawan A–Z" },
];

export const DOCUMENT_TYPE_FILTERS: ("Semua" | DocumentType)[] = [
  "Semua",
  ...DOCUMENT_TYPES,
];

export const DOCUMENT_STATUS_FILTERS: DocumentStatusFilter[] = [
  "Semua",
  "Akan Habis",
  "Kedaluwarsa",
];

export type DocumentResult = {
  rows: EmployeeDocument[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

export function filterDocuments(
  documents: EmployeeDocument[],
  filters: DocumentFilters,
  todayIso: string
): DocumentResult {
  const term = filters.q.trim().toLowerCase();

  const filtered = documents.filter((document) => {
    const haystack =
      `${document.employeeName} ${document.employeeId} ${document.docType} ${document.title ?? ""} ${document.fileName}`.toLowerCase();
    const status = documentExpiryStatus(document.validUntil, todayIso);

    return (
      (!term || haystack.includes(term)) &&
      (filters.docType === "Semua" || document.docType === filters.docType) &&
      (filters.status === "Semua" || status === filters.status)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "uploaded-asc":
        return a.uploadedAt.localeCompare(b.uploadedAt);
      case "expiry-asc":
        if (!a.validUntil) return 1;
        if (!b.validUntil) return -1;
        return a.validUntil.localeCompare(b.validUntil);
      case "name-asc":
        return (
          a.employeeName.localeCompare(b.employeeName, "id") ||
          a.docType.localeCompare(b.docType, "id")
        );
      case "uploaded-desc":
      default:
        return b.uploadedAt.localeCompare(a.uploadedAt);
    }
  });

  const pageSize = Math.max(1, filters.pageSize);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

export type DocumentStats = {
  total: number;
  expiring: number;
  expired: number;
};

export function buildDocumentStats(
  documents: EmployeeDocument[],
  todayIso: string
): DocumentStats {
  let expiring = 0;
  let expired = 0;

  documents.forEach((document) => {
    const status = documentExpiryStatus(document.validUntil, todayIso);
    if (status === "Akan Habis") expiring += 1;
    else if (status === "Kedaluwarsa") expired += 1;
  });

  return { total: documents.length, expiring, expired };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
