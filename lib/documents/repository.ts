/**
 * Lapisan akses data Dokumen & Berkas (server-side).
 *
 * Satu-satunya tempat query tabel employee_documents / riwayatnya dan satu-
 * satunya tempat pemakaian service role untuk bucket `employee-documents`.
 * `file_path` tidak pernah keluar dari modul ini.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import type {
  DocumentEmployeeRef,
  DocumentFieldErrors,
  DocumentMimeType,
  DocumentType,
  EmployeeDocument,
  EmployeeDocumentHistory,
  EmployeeDocumentsData,
  DocumentUpdateInput,
  DocumentUploadInput,
} from "@/lib/documents/types";
import {
  DOCUMENT_BUCKET,
  extensionForMime,
  sanitizeFileName,
} from "@/lib/documents/validation";

export class DocumentDataError extends Error {
  readonly status: number;
  readonly errors?: DocumentFieldErrors;

  constructor(message: string, status = 400, errors?: DocumentFieldErrors) {
    super(message);
    this.name = "DocumentDataError";
    this.status = status;
    this.errors = errors;
  }
}

type DocumentRow = {
  id: string;
  employee_id: string;
  doc_type: DocumentType;
  title: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: DocumentMimeType;
  valid_until: string | null;
  uploaded_at: string;
  updated_at: string;
};

type HistoryRow = {
  id: number;
  document_id: string;
  doc_type: DocumentType;
  file_name: string;
  action: EmployeeDocumentHistory["action"];
  changed_by: string | null;
  changed_at: string;
};

type EmployeeRefRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
};

const PUBLIC_COLUMNS =
  "id, employee_id, doc_type, title, file_name, file_size, mime_type, valid_until, uploaded_at, updated_at";
const FILE_COLUMNS = `${PUBLIC_COLUMNS},file_path`;
const EMPLOYEE_COLUMNS = "id, full_name, position, department";

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new DocumentDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  if (error.code === "23503") {
    return new DocumentDataError("Karyawan tidak ditemukan", 404);
  }
  if (error.code === "23505") {
    return new DocumentDataError("Dokumen yang sama sudah tercatat", 409);
  }
  if (error.code === "23514" || error.code === "23502") {
    return new DocumentDataError(
      "Data dokumen tidak lolos validasi. Periksa jenis, judul, dan tanggal berlaku.",
      400
    );
  }
  return new DocumentDataError(`Gagal ${action} dokumen`, 500);
};

const toDocument = (
  row: DocumentRow,
  employee: DocumentEmployeeRef | undefined
): EmployeeDocument => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: employee?.fullName ?? "Karyawan tidak ditemukan",
  employeePosition: employee?.position ?? "—",
  docType: row.doc_type,
  title: row.title,
  fileName: row.file_name,
  fileSize: row.file_size,
  mimeType: row.mime_type,
  validUntil: row.valid_until,
  uploadedAt: row.uploaded_at,
  updatedAt: row.updated_at,
});

const removeStoredFile = async (path: string) => {
  const cleanup = await getServiceSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .remove([path]);
  if (cleanup.error) {
    console.error("[documents] Gagal menghapus file storage", path);
  }
  return !cleanup.error;
};

const uploadStoredFile = async (
  employeeId: string,
  file: File,
  mimeType: DocumentMimeType
): Promise<string> => {
  const path = `${employeeId}/${randomUUID()}.${extensionForMime(mimeType)}`;
  const upload = await getServiceSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: mimeType,
      upsert: false,
    });

  if (upload.error) {
    throw new DocumentDataError(
      "File dokumen gagal diunggah ke penyimpanan. Coba lagi.",
      502
    );
  }

  return path;
};

const storedFileName = (file: File, mimeType: DocumentMimeType): string =>
  sanitizeFileName(file.name) || `dokumen.${extensionForMime(mimeType)}`;

/** Daftar dokumen lintas karyawan untuk HR Manager/Admin. */
export async function listEmployeeDocuments(): Promise<EmployeeDocument[]> {
  const db = await getServerSupabase();
  const [documentResult, employeeResult] = await Promise.all([
    db.from("employee_documents").select(PUBLIC_COLUMNS).order("uploaded_at", {
      ascending: false,
    }),
    db.from("employees").select(EMPLOYEE_COLUMNS),
  ]);

  if (documentResult.error) throw mapDbError(documentResult.error, "memuat");
  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat data karyawan");
  }

  const employees = new Map(
    ((employeeResult.data ?? []) as EmployeeRefRow[]).map((row) => [
      row.id,
      {
        id: row.id,
        fullName: row.full_name,
        position: row.position,
        department: row.department,
      },
    ])
  );

  return ((documentResult.data ?? []) as DocumentRow[]).map((row) =>
    toDocument(row, employees.get(row.employee_id))
  );
}

const loadActorNames = async (
  history: HistoryRow[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> => {
  const ids = [
    ...new Set(
      history
        .map((row) => row.changed_by)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const nameById = new Map<string, string>();
  if (ids.length === 0) return { nameById, resolved: true };

  const { data, error } = await (await getServerSupabase()).rpc(
    "user_full_names",
    { p_ids: ids }
  );

  if (error) return { nameById, resolved: false };

  for (const actor of (data ?? []) as { id: string; full_name: string }[]) {
    nameById.set(actor.id, actor.full_name);
  }
  return { nameById, resolved: true };
};

const toHistory = (
  row: HistoryRow,
  nameById: Map<string, string>,
  resolved: boolean
): EmployeeDocumentHistory => ({
  id: row.id,
  documentId: row.document_id,
  docType: row.doc_type,
  fileName: row.file_name,
  action: row.action,
  changedByName: row.changed_by
    ? nameById.get(row.changed_by) ??
      (resolved ? "Pengguna terhapus" : "Pengguna")
    : "Sistem",
  changedAt: row.changed_at,
});

/** Dokumen + riwayat untuk satu karyawan (drawer HR). */
export async function getEmployeeDocuments(
  employeeId: string
): Promise<EmployeeDocumentsData | null> {
  const db = await getServerSupabase();
  const employeeResult = await db
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat karyawan");
  }
  if (!employeeResult.data) return null;

  const employeeRow = employeeResult.data as EmployeeRefRow;
  const employee: DocumentEmployeeRef = {
    id: employeeRow.id,
    fullName: employeeRow.full_name,
    position: employeeRow.position,
    department: employeeRow.department,
  };

  const [documentResult, historyResult] = await Promise.all([
    db
      .from("employee_documents")
      .select(PUBLIC_COLUMNS)
      .eq("employee_id", employeeId)
      .order("uploaded_at", { ascending: false }),
    db
      .from("employee_document_history")
      .select("id, document_id, doc_type, file_name, action, changed_by, changed_at")
      .eq("employee_id", employeeId)
      .order("changed_at", { ascending: false })
      .limit(100),
  ]);

  if (documentResult.error) throw mapDbError(documentResult.error, "memuat");
  if (historyResult.error) {
    throw mapDbError(historyResult.error, "memuat riwayat");
  }

  const historyRows = (historyResult.data ?? []) as HistoryRow[];
  const { nameById, resolved } = await loadActorNames(historyRows);

  return {
    employee,
    documents: ((documentResult.data ?? []) as DocumentRow[]).map((row) =>
      toDocument(row, employee)
    ),
    history: historyRows.map((row) => toHistory(row, nameById, resolved)),
  };
}

/** Dokumen milik karyawan yang tertaut ke akun pemanggil (sumber: database). */
export async function listMyDocuments(): Promise<{
  employeeId: string | null;
  documents: EmployeeDocument[];
}> {
  const db = await getServerSupabase();
  const { data: employeeId, error } = await db.rpc("current_employee_id");

  if (error) {
    throw new DocumentDataError("Gagal memuat data karyawan akun ini", 500);
  }
  if (typeof employeeId !== "string" || employeeId === "") {
    return { employeeId: null, documents: [] };
  }

  const [employeeResult, documentResult] = await Promise.all([
    db
      .from("employees")
      .select(EMPLOYEE_COLUMNS)
      .eq("id", employeeId)
      .maybeSingle(),
    db
      .from("employee_documents")
      .select(PUBLIC_COLUMNS)
      .eq("employee_id", employeeId)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat karyawan");
  }
  if (documentResult.error) throw mapDbError(documentResult.error, "memuat");

  const employeeRow = employeeResult.data as EmployeeRefRow | null;
  const employee: DocumentEmployeeRef | undefined = employeeRow
    ? {
        id: employeeRow.id,
        fullName: employeeRow.full_name,
        position: employeeRow.position,
        department: employeeRow.department,
      }
    : undefined;

  return {
    employeeId,
    documents: ((documentResult.data ?? []) as DocumentRow[]).map((row) =>
      toDocument(row, employee)
    ),
  };
}

export async function createEmployeeDocument(
  input: DocumentUploadInput,
  file: File,
  mimeType: DocumentMimeType
): Promise<void> {
  const db = await getServerSupabase();
  const employee = await db
    .from("employees")
    .select("id")
    .eq("id", input.employeeId)
    .maybeSingle();

  if (employee.error) throw mapDbError(employee.error, "memuat karyawan");
  if (!employee.data) {
    throw new DocumentDataError("Karyawan tidak ditemukan", 404);
  }

  const path = await uploadStoredFile(input.employeeId, file, mimeType);
  const { error } = await db.from("employee_documents").insert({
    employee_id: input.employeeId,
    doc_type: input.docType,
    title: input.title,
    file_path: path,
    file_name: storedFileName(file, mimeType),
    file_size: file.size,
    mime_type: mimeType,
    valid_until: input.validUntil,
  });

  if (error) {
    await removeStoredFile(path);
    throw mapDbError(error, "menyimpan");
  }
}

/**
 * Ubah metadata dan/atau ganti file. File lama baru dihapus setelah baris
 * berhasil diperbarui; kegagalan pembersihan lama tidak membatalkan simpan.
 */
export async function updateEmployeeDocument(
  id: string,
  input: DocumentUpdateInput,
  file: File | null,
  mimeType: DocumentMimeType | null
): Promise<{ warning: string | null }> {
  const db = await getServerSupabase();
  const currentResult = await db
    .from("employee_documents")
    .select("id, employee_id, file_path")
    .eq("id", id)
    .maybeSingle();

  if (currentResult.error) {
    throw mapDbError(currentResult.error, "membaca");
  }
  if (!currentResult.data) {
    throw new DocumentDataError("Dokumen tidak ditemukan", 404);
  }

  const current = currentResult.data as {
    id: string;
    employee_id: string;
    file_path: string;
  };

  let newPath: string | null = null;
  if (file && mimeType) {
    newPath = await uploadStoredFile(current.employee_id, file, mimeType);
  }

  const { error } = await db
    .from("employee_documents")
    .update({
      doc_type: input.docType,
      title: input.title,
      valid_until: input.validUntil,
      ...(file && mimeType && newPath
        ? {
            file_path: newPath,
            file_name: storedFileName(file, mimeType),
            file_size: file.size,
            mime_type: mimeType,
          }
        : {}),
    })
    .eq("id", id);

  if (error) {
    if (newPath) await removeStoredFile(newPath);
    throw mapDbError(error, "memperbarui");
  }

  if (newPath && newPath !== current.file_path) {
    const cleaned = await removeStoredFile(current.file_path);
    if (!cleaned) {
      return {
        warning:
          "Dokumen tersimpan, tetapi file lama gagal dibersihkan dari penyimpanan.",
      };
    }
  }

  return { warning: null };
}

/**
 * Hapus dokumen: file lebih dulu, baris setelahnya. Bila storage gagal,
 * baris dipertahankan dan pengguna menerima pesan yang jelas.
 */
export async function deleteEmployeeDocument(id: string): Promise<void> {
  const db = await getServerSupabase();
  const currentResult = await db
    .from("employee_documents")
    .select("id, file_path")
    .eq("id", id)
    .maybeSingle();

  if (currentResult.error) {
    throw mapDbError(currentResult.error, "membaca");
  }
  if (!currentResult.data) {
    throw new DocumentDataError("Dokumen tidak ditemukan", 404);
  }

  const current = currentResult.data as { id: string; file_path: string };
  const removed = await getServiceSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .remove([current.file_path]);

  if (removed.error) {
    throw new DocumentDataError(
      "File dokumen gagal dihapus dari penyimpanan. Data dokumen belum dihapus; silakan coba lagi.",
      502
    );
  }

  const { error } = await db
    .from("employee_documents")
    .delete()
    .eq("id", id);

  if (error) {
    throw new DocumentDataError(
      "File sudah terhapus, tetapi data dokumen gagal dihapus. Coba hapus ulang atau hubungi administrator.",
      500
    );
  }
}

/**
 * URL bertanda tangan 60 detik. Baris dibaca dengan session pengguna sehingga
 * RLS sudah membatasi karyawan ke dokumennya sendiri; kepemilikan diperiksa
 * ulang dari database untuk role employee.
 */
export async function getDocumentSignedUrl(
  id: string,
  role: "admin" | "hr_manager" | "recruiter" | "employee",
  download: boolean
): Promise<string> {
  const db = await getServerSupabase();
  const { data, error } = await db
    .from("employee_documents")
    .select("employee_id, file_path, file_name")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapDbError(error, "membaca");
  if (!data) {
    throw new DocumentDataError("Dokumen tidak ditemukan", 404);
  }

  const row = data as {
    employee_id: string;
    file_path: string;
    file_name: string;
  };

  if (role === "employee") {
    const { data: ownEmployeeId, error: ownershipError } = await db.rpc(
      "current_employee_id"
    );
    if (ownershipError || ownEmployeeId !== row.employee_id) {
      throw new DocumentDataError("Akses ditolak", 403);
    }
  }

  const signed = await getServiceSupabase()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUrl(
      row.file_path,
      60,
      download ? { download: row.file_name } : undefined
    );

  if (signed.error) {
    throw new DocumentDataError("Gagal membuka file dokumen", 502);
  }

  return signed.data.signedUrl;
}
