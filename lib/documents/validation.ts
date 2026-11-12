/** Aturan murni dokumen: jenis, metadata, dan validasi berkas. */

import {
  DOCUMENT_TYPES,
  type DocumentFieldErrors,
  type DocumentMimeType,
  type DocumentType,
} from "@/lib/documents/types";

export const DOCUMENT_BUCKET = "employee-documents";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MAX_TITLE = 150;
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png";

const MIME_EXTENSIONS: Record<DocumentMimeType, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
};

export const isDocumentType = (value: unknown): value is DocumentType =>
  typeof value === "string" &&
  (DOCUMENT_TYPES as readonly string[]).includes(value);

/** Hanya nama dasar berkas; buang path dan karakter kontrol. */
export const sanitizeFileName = (value: string): string =>
  value
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200) ?? "";

export const normalizeDocumentTitle = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export const normaliseMimeType = (value: string): string => {
  const lowered = value.trim().toLowerCase();
  return lowered === "image/jpg" ? "image/jpeg" : lowered;
};

export const isValidIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export type DocumentMetaInput = {
  docType: unknown;
  title: unknown;
  validUntil: unknown;
};

export function validateDocumentMeta(
  input: DocumentMetaInput
): DocumentFieldErrors {
  const errors: DocumentFieldErrors = {};

  if (!isDocumentType(input.docType)) {
    errors.docType = "Pilih jenis dokumen yang valid";
  }

  const title = normalizeDocumentTitle(input.title);
  if (title && title.length > DOCUMENT_MAX_TITLE) {
    errors.title = `Judul maksimal ${DOCUMENT_MAX_TITLE} karakter`;
  }

  if (typeof input.validUntil === "string" && input.validUntil.trim() !== "") {
    if (!isValidIsoDate(input.validUntil.trim())) {
      errors.validUntil = "Tanggal berlaku tidak valid";
    }
  }

  return errors;
}

/** Validasi ringan di klien: ukuran, ekstensi, dan tipe deklarasi. */
export function validateDocumentFileMeta(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (file.size <= 0) return "Pilih file dokumen";
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "Ukuran file maksimal 5 MB";
  }

  const extension = extensionOf(file.name);
  const allowedExtensions = Object.values(MIME_EXTENSIONS).flat();
  if (!allowedExtensions.includes(extension)) {
    return "Format file harus PDF, JPG, atau PNG";
  }

  const declared = normaliseMimeType(file.type);
  if (
    declared &&
    declared !== "application/octet-stream" &&
    !(declared in MIME_EXTENSIONS)
  ) {
    return "Format file harus PDF, JPG, atau PNG";
  }

  return null;
}

const startsWith = (bytes: Uint8Array, signature: number[]): boolean =>
  signature.every((value, index) => bytes[index] === value);

/** Deteksi dari penanda byte asli berkas, bukan dari nama/tipe deklarasi. */
export function detectDocumentMime(
  bytes: Uint8Array
): DocumentMimeType | null {
  if (bytes.length >= 5 && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "application/pdf";
  }
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  return null;
}

/** Cocokkan isi berkas, ekstensi, dan tipe yang dikirim browser. */
export function validateDocumentFileBytes(
  bytes: Uint8Array,
  fileName: string,
  declaredType: string
): { ok: true; mimeType: DocumentMimeType } | { ok: false; error: string } {
  const detected = detectDocumentMime(bytes);
  if (!detected) {
    return { ok: false, error: "File bukan PDF, JPG, atau PNG yang valid" };
  }

  const extension = extensionOf(fileName);
  if (!MIME_EXTENSIONS[detected].includes(extension)) {
    return {
      ok: false,
      error: "Ekstensi file tidak sesuai dengan isi berkas",
    };
  }

  const declared = normaliseMimeType(declaredType);
  if (
    declared &&
    declared !== "application/octet-stream" &&
    declared !== detected
  ) {
    return {
      ok: false,
      error: "Tipe file tidak sesuai dengan isi berkas",
    };
  }

  return { ok: true, mimeType: detected };
}

export const extensionForMime = (mimeType: DocumentMimeType): string =>
  mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg";
