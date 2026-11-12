"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { DocumentFormModal } from "@/components/documents/document-form-modal";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { formatFileSize } from "@/lib/documents/query";
import {
  documentExpiryStatus,
  documentStatusTone,
} from "@/lib/documents/status";
import type {
  DocumentAction,
  EmployeeDocument,
  EmployeeDocumentsData,
} from "@/lib/documents/types";
import { ini } from "@/lib/data";
import "@/components/recruitment-live/live.css";

const ACTION_TONES: Record<DocumentAction, string> = {
  Diunggah: "t-ok",
  Diubah: "t-mute",
  Diganti: "t-warn",
  Dihapus: "t-bad",
};

export function EmployeeDocumentsPanel({
  employeeId,
  todayIso,
  showEmployeeHeader = false,
  showHeading = true,
  onMutated,
}: {
  employeeId: string;
  todayIso: string;
  showEmployeeHeader?: boolean;
  showHeading?: boolean;
  onMutated: (message: string) => void;
}) {
  const [data, setData] = useState<EmployeeDocumentsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<EmployeeDocument | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setData(null);
    setUploadOpen(false);
    setReplaceTarget(null);
    setDeleteTarget(null);
    setDeleteError("");
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) return;

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/documents/employee/${employeeId}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | (EmployeeDocumentsData & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Gagal memuat dokumen karyawan");
        }
        return body as EmployeeDocumentsData;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat dokumen karyawan"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employeeId, reloadKey]);

  const handleMutated = (message: string) => {
    setUploadOpen(false);
    setReplaceTarget(null);
    setReloadKey((key) => key + 1);
    onMutated(message);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menghapus dokumen");
      }
      setDeleteTarget(null);
      handleMutated("Dokumen dihapus");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus dokumen";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {showEmployeeHeader && data?.employee && (
        <div className="flex items-center gap-4 mb-5">
          <div className="av" style={{ width: 56, height: 56, fontSize: 18 }}>
            {ini(data.employee.fullName)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[19px] leading-tight">
              {data.employee.fullName}
            </div>
            <div className="sub text-[13px]">
              {data.employee.id} · {data.employee.position}
            </div>
            <div className="sub text-[12px]">{data.employee.department}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          {showHeading && <div className="font-bold">Dokumen</div>}
          <div className="text-[11px] sub">
            {data
              ? `${data.documents.length} dokumen tersimpan`
              : "Memuat dokumen…"}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-p"
          onClick={() => setUploadOpen(true)}
          disabled={!data}
        >
          Unggah
        </button>
      </div>

      {loading && !data && (
        <div className="sub text-[13px]">Memuat dokumen…</div>
      )}

      {error && (
        <div className="tag t-bad mb-4 w-full justify-center">{error}</div>
      )}

      {data && (
        <>
          <div className="flex flex-col gap-2 mb-6">
            {data.documents.map((document) => {
              const status = documentExpiryStatus(
                document.validUntil,
                todayIso
              );
              return (
                <div
                  key={document.id}
                  className="p-3 rounded-xl border"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="tag t-mute">{document.docType}</span>
                        {status && (
                          <span
                            className={`tag ${documentStatusTone(status)}`}
                          >
                            {status}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-[13px] mt-1 break-words">
                        {document.title ?? document.fileName}
                      </div>
                      <div className="text-[11px] sub break-words">
                        {document.fileName} ·{" "}
                        {formatFileSize(document.fileSize)}
                      </div>
                      <div className="text-[11px] sub mt-1">
                        Berlaku s/d {formatDateID(document.validUntil)} ·
                        Diunggah {formatDateID(document.uploadedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <a
                      className="btn btn-g !py-1 !px-3"
                      href={`/api/documents/${document.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lihat
                    </a>
                    <button
                      type="button"
                      className="btn btn-g !py-1 !px-3"
                      onClick={() => setReplaceTarget(document)}
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      className="btn btn-g !py-1 !px-3"
                      style={{ color: "var(--bad)" }}
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(document);
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
            {data.documents.length === 0 && (
              <div className="sub text-[13px]">
                Belum ada dokumen untuk karyawan ini. Unggah dokumen pertama
                lewat tombol di atas.
              </div>
            )}
          </div>

          <div className="font-bold mb-3">Riwayat Dokumen</div>
          <div className="flex flex-col gap-3">
            {data.history.map((entry) => (
              <div className="flex gap-3" key={entry.id}>
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: "var(--pink)" }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`tag ${ACTION_TONES[entry.action]}`}>
                      {entry.action}
                    </span>
                    <span className="text-[13px] font-semibold">
                      {entry.docType}
                    </span>
                  </div>
                  <div className="text-[11px] sub break-words">
                    {entry.fileName}
                  </div>
                  <div className="text-[11px] sub">
                    {formatDateTimeID(entry.changedAt)} ·{" "}
                    {entry.changedByName}
                  </div>
                </div>
              </div>
            ))}
            {data.history.length === 0 && (
              <div className="sub text-[13px]">
                Belum ada riwayat dokumen.
              </div>
            )}
          </div>
        </>
      )}

      {uploadOpen && (
        <DocumentFormModal
          mode="create"
          employeeId={employeeId}
          onClose={() => setUploadOpen(false)}
          onSaved={handleMutated}
        />
      )}

      {replaceTarget && (
        <DocumentFormModal
          mode="replace"
          employeeId={employeeId}
          document={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onSaved={handleMutated}
        />
      )}

      {deleteTarget && (
        <div className="rl">
          <ConfirmDialog
            title="Hapus dokumen?"
            description={`Dokumen "${deleteTarget.title ?? deleteTarget.fileName}" akan dihapus permanen beserta filenya. Tindakan ini tidak bisa dibatalkan.`}
            confirmLabel="Ya, hapus"
            danger
            busy={deleting}
            error={deleteError}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => void confirmDelete()}
          />
        </div>
      )}
    </>
  );
}
