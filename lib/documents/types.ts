/** Tipe domain modul Dokumen & Berkas. */

export const DOCUMENT_TYPES = [
  "KTP",
  "KK",
  "Ijazah",
  "Sertifikat",
  "Kontrak Tertanda",
  "Surat Lainnya",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

export type DocumentAction = "Diunggah" | "Diubah" | "Diganti" | "Dihapus";

/** Baris dokumen untuk UI. `file_path` tidak pernah keluar dari server. */
export type EmployeeDocument = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  docType: DocumentType;
  title: string | null;
  fileName: string;
  fileSize: number;
  mimeType: DocumentMimeType;
  validUntil: string | null;
  uploadedAt: string;
  updatedAt: string;
};

export type EmployeeDocumentHistory = {
  id: number;
  documentId: string;
  docType: DocumentType;
  fileName: string;
  action: DocumentAction;
  /** Nama pelaku; "Sistem" bila tanpa aktor, "Pengguna terhapus" bila akun hilang. */
  changedByName: string;
  changedAt: string;
};

export type DocumentEmployeeRef = {
  id: string;
  fullName: string;
  position: string;
  department: string;
};

export type EmployeeDocumentsData = {
  employee: DocumentEmployeeRef | null;
  documents: EmployeeDocument[];
  history: EmployeeDocumentHistory[];
};

export type DocumentListResponse = {
  documents: EmployeeDocument[];
};

export type DocumentUploadInput = {
  employeeId: string;
  docType: DocumentType;
  title: string | null;
  validUntil: string | null;
};

export type DocumentUpdateInput = {
  docType: DocumentType;
  title: string | null;
  validUntil: string | null;
};

export type DocumentFieldErrors = Record<string, string>;
