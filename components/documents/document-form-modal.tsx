"use client";

import { useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_TITLE,
  validateDocumentFileMeta,
  validateDocumentMeta,
} from "@/lib/documents/validation";
import {
  DOCUMENT_TYPES,
  type DocumentFieldErrors,
  type DocumentType,
  type EmployeeDocument,
} from "@/lib/documents/types";
import { formatFileSize } from "@/lib/documents/query";
import "@/components/recruitment-live/live.css";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

export function DocumentFormModal({
  mode,
  employeeId,
  document = null,
  onClose,
  onSaved,
}: {
  mode: "create" | "replace";
  employeeId: string;
  document?: EmployeeDocument | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [docType, setDocType] = useState<DocumentType>(
    document?.docType ?? "KTP"
  );
  const [title, setTitle] = useState(document?.title ?? "");
  const [validUntil, setValidUntil] = useState(document?.validUntil ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<DocumentFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty =
    mode === "create" ||
    Boolean(file) ||
    docType !== (document?.docType ?? "KTP") ||
    title.trim() !== (document?.title ?? "") ||
    validUntil !== (document?.validUntil ?? "");

  const clearError = (key: string) => {
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateField = (key: "title" | "validUntil") => {
    const next = validateDocumentMeta({ docType, title, validUntil });
    setErrors((current) => {
      const merged = { ...current };
      if (next[key]) merged[key] = next[key];
      else delete merged[key];
      return merged;
    });
  };

  const pickFile = (value: File | null) => {
    setFile(value);
    setFormError("");
    if (!value) {
      clearError("file");
      return;
    }
    const fileError = validateDocumentFileMeta(value);
    setErrors((current) => {
      const merged = { ...current };
      if (fileError) merged.file = fileError;
      else delete merged.file;
      return merged;
    });
  };

  const submit = async () => {
    const nextErrors = validateDocumentMeta({ docType, title, validUntil });
    if (mode === "create" && !file) {
      nextErrors.file = "Pilih file dokumen";
    } else if (file) {
      const fileError = validateDocumentFileMeta(file);
      if (fileError) nextErrors.file = fileError;
    }

    setErrors(nextErrors);
    setFormError("");

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Periksa kembali isian yang ditandai merah.");
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append("docType", docType);
      form.append("title", title);
      form.append("validUntil", validUntil);
      if (file) form.append("file", file);
      if (mode === "create") form.append("employeeId", employeeId);

      const response = await fetch(
        mode === "create" ? "/api/documents" : `/api/documents/${document?.id}`,
        { method: mode === "create" ? "POST" : "PATCH", body: form }
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        errors?: DocumentFieldErrors;
        warning?: string | null;
      } | null;

      if (!response.ok) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error ?? "Gagal menyimpan dokumen");
      }

      const message =
        mode === "create"
          ? "Dokumen berhasil diunggah"
          : file
            ? "File dokumen berhasil diganti"
            : "Data dokumen diperbarui";

      onSaved(data?.warning ? `${message}. ${data.warning}` : message);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Gagal menyimpan dokumen"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rl">
      <Modal
        title={mode === "create" ? "Unggah Dokumen" : "Ganti Dokumen"}
        onClose={onClose}
        busy={saving}
      >
        {formError && <ErrorBox message={formError} />}
        <div className="rl-fields-grid">
          <div className="rl-field">
            <label htmlFor="document-type">Jenis dokumen *</label>
            <select
              id="document-type"
              className="rl-input"
              value={docType}
              disabled={saving}
              onChange={(event) => {
                setDocType(event.target.value as DocumentType);
                clearError("docType");
              }}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <FieldError message={errors.docType} />
          </div>

          <div className="rl-field">
            <label htmlFor="document-valid-until">Berlaku sampai</label>
            <input
              id="document-valid-until"
              type="date"
              className="rl-input"
              value={validUntil}
              disabled={saving}
              onChange={(event) => {
                setValidUntil(event.target.value);
                clearError("validUntil");
              }}
              onBlur={() => validateField("validUntil")}
              aria-invalid={Boolean(errors.validUntil)}
            />
            <FieldError message={errors.validUntil} />
          </div>

          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="document-title">Judul dokumen</label>
            <input
              id="document-title"
              className="rl-input"
              maxLength={DOCUMENT_MAX_TITLE}
              placeholder="cth. KTP Salsabila Putri"
              value={title}
              disabled={saving}
              onChange={(event) => {
                setTitle(event.target.value);
                clearError("title");
              }}
              onBlur={() => validateField("title")}
              aria-invalid={Boolean(errors.title)}
            />
            <FieldError message={errors.title} />
          </div>

          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="document-file">
              {mode === "create" ? "File dokumen *" : "Ganti file (opsional)"}
            </label>
            <input
              id="document-file"
              type="file"
              className="rl-input"
              accept={DOCUMENT_ACCEPT}
              disabled={saving}
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
              aria-invalid={Boolean(errors.file)}
            />
            <FieldError message={errors.file} />
            {file && !errors.file && (
              <div className="text-[11px] sub mt-1">
                {file.name} · {formatFileSize(file.size)}
              </div>
            )}
          </div>
        </div>

        <p className="sub text-[11px] mt-3">
          PDF, JPG, atau PNG. Maksimal 5 MB.
          {mode === "replace"
            ? " Kosongkan file jika hanya ingin mengubah jenis, judul, atau tanggal berlaku."
            : ""}
        </p>

        <div className="rl-actions">
          <button
            type="button"
            className="rl-btn"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </button>
          <button
            type="button"
            className="rl-btn rl-primary"
            onClick={() => void submit()}
            disabled={saving || !dirty}
          >
            {saving
              ? "Menyimpan…"
              : mode === "create"
                ? "Unggah"
                : "Simpan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
