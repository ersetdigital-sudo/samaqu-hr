"use client";

import { useEffect, useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import type { EmployeeSummary } from "@/lib/employees/types";
import "@/components/recruitment-live/live.css";

export function PerformanceReviewerDialog({
  open,
  reviewId,
  employeeId,
  employeeName,
  currentReviewerId,
  onClose,
  onSaved,
}: {
  open: boolean;
  reviewId: string;
  employeeId: string;
  employeeName: string;
  currentReviewerId: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [reviewerId, setReviewerId] = useState(currentReviewerId ?? "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReviewerId(currentReviewerId ?? "");
    setReason("");
    setError("");
    setLoading(true);
    fetch("/api/employees", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          employees?: EmployeeSummary[];
          error?: string;
        } | null;
        if (!response.ok || !body?.employees) {
          throw new Error(body?.error ?? "Gagal memuat karyawan");
        }
        setEmployees(body.employees);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Gagal memuat karyawan")
      )
      .finally(() => setLoading(false));
  }, [open, currentReviewerId]);

  if (!open) return null;

  const options = employees.filter(
    (employee) =>
      employee.id !== employeeId &&
      (employee.status === "Aktif" || employee.status === "Probation")
  );

  const submit = async () => {
    if (!reviewerId) {
      setError("Penilai wajib dipilih.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan penggantian penilai wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/performance/reviews/${reviewId}/reviewer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewerEmployeeId: reviewerId,
            reason: reason.trim(),
          }),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal mengganti penilai");
      }
      onSaved("Penilai diperbarui");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengganti penilai");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rl">
      <Modal title="Ganti Penilai" onClose={onClose} busy={saving}>
        <p className="rl-dialog-body">
          Pilih penilai untuk <b>{employeeName}</b>. Penggantian tercatat di
          riwayat lembar.
        </p>
        {error && <ErrorBox message={error} />}
        <div className="rl-field mt-3">
          <label htmlFor="performance-reviewer">Penilai *</label>
          <select
            id="performance-reviewer"
            className="rl-input"
            value={reviewerId}
            disabled={loading || saving}
            onChange={(event) => setReviewerId(event.target.value)}
          >
            <option value="">Pilih penilai</option>
            {options.map((employee) => (
              <option value={employee.id} key={employee.id}>
                {employee.fullName} · {employee.position}
              </option>
            ))}
          </select>
          {loading && <div className="text-[11px] sub mt-1">Memuat karyawan…</div>}
        </div>
        <div className="rl-field mt-3">
          <label htmlFor="performance-reviewer-reason">Alasan *</label>
          <textarea
            id="performance-reviewer-reason"
            className="rl-input"
            rows={3}
            maxLength={1000}
            value={reason}
            disabled={saving}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="rl-dialog-footer">
          <button type="button" className="rl-btn" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button
            type="button"
            className="rl-btn rl-primary"
            onClick={() => void submit()}
            disabled={saving || loading}
          >
            {saving ? "Memproses…" : "Simpan Penilai"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
