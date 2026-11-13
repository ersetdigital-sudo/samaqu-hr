"use client";

import { useEffect, useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import { overtimeFormulaLabel } from "@/lib/overtime/rules";
import type { OvertimeRequest } from "@/lib/overtime/types";
import "@/components/recruitment-live/live.css";

export type OvertimeDecisionMode = "approve" | "reject" | "hr-cancel";

export function OvertimeDecisionDialog({
  open,
  mode,
  request,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: OvertimeDecisionMode;
  request: OvertimeRequest | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (approvedMinutes: number | null, reason: string) => void;
}) {
  const [approvedHours, setApprovedHours] = useState(0);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open || !request) return;
    setApprovedHours(request.requestedMinutes / 60);
    setReason("");
    setLocalError("");
  }, [open, request]);

  if (!open || !request) return null;

  const title =
    mode === "approve"
      ? "Setujui lembur"
      : mode === "reject"
        ? "Tolak pengajuan lembur"
        : "Batalkan lembur disetujui";
  const description =
    mode === "approve"
      ? `Ajukan ${request.employeeName} · ${request.requestDate}. Jam disetujui tidak boleh lebih dari ${request.requestedMinutes / 60} jam.`
      : mode === "reject"
        ? "Pengajuan akan ditolak dan alasan terlihat oleh karyawan."
        : "Lembur yang sudah disetujui akan dibatalkan dan alasan tercatat di riwayat.";

  const submit = () => {
    if (mode === "approve") {
      const minutes = Math.round(approvedHours * 60);
      if (
        !Number.isFinite(approvedHours) ||
        approvedHours <= 0 ||
        minutes % 30 !== 0 ||
        minutes > request.requestedMinutes
      ) {
        setLocalError(
          `Jam disetujui harus kelipatan 0,5 dan maksimal ${
            request.requestedMinutes / 60
          } jam.`
        );
        return;
      }
      onConfirm(minutes, reason.trim());
      return;
    }

    if (!reason.trim()) {
      setLocalError("Alasan wajib diisi.");
      return;
    }
    onConfirm(null, reason.trim());
  };

  const approvedMinutes = Math.round(approvedHours * 60);

  return (
    <div className="rl">
      <Modal title={title} onClose={onClose} busy={busy}>
        <p className="rl-dialog-body">{description}</p>
        {error && <ErrorBox message={error} />}

        {mode === "approve" ? (
          <>
            <div className="rl-field mt-3">
              <label htmlFor="overtime-approved-hours">
                Jam disetujui (jam) *
              </label>
              <input
                id="overtime-approved-hours"
                type="number"
                className="rl-input"
                min={0.5}
                max={request.requestedMinutes / 60}
                step={0.5}
                value={approvedHours}
                disabled={busy}
                onChange={(event) => {
                  setApprovedHours(Number(event.target.value));
                  setLocalError("");
                }}
              />
              <div className="text-[11px] sub mt-1">
                Diajukan {request.requestedMinutes / 60} jam
              </div>
              {localError && (
                <div
                  className="text-[11px] mt-1"
                  style={{ color: "var(--bad)" }}
                >
                  {localError}
                </div>
              )}
            </div>
            <div
              className="p-3 rounded-xl text-[12px] mt-3"
              style={{ background: "#FAF7F5" }}
            >
              <div className="font-semibold">Perhitungan ekuivalen</div>
              <div className="sub mt-1">
                {overtimeFormulaLabel(
                  Math.max(approvedMinutes, 0),
                  request.dayType
                )}
              </div>
            </div>
            <div className="rl-field mt-3">
              <label htmlFor="overtime-approve-note">Catatan (opsional)</label>
              <textarea
                id="overtime-approve-note"
                className="rl-input"
                rows={2}
                maxLength={1000}
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="rl-field mt-3">
            <label htmlFor="overtime-decision-reason">Alasan *</label>
            <textarea
              id="overtime-decision-reason"
              className="rl-input"
              rows={3}
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(event) => {
                setReason(event.target.value);
                setLocalError("");
              }}
            />
            {localError && (
              <div
                className="text-[11px] mt-1"
                style={{ color: "var(--bad)" }}
              >
                {localError}
              </div>
            )}
          </div>
        )}

        <div className="rl-dialog-footer">
          <button
            type="button"
            className="rl-btn"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className={`rl-btn ${
              mode === "approve" ? "rl-primary" : "rl-danger"
            }`}
            onClick={submit}
            disabled={busy}
          >
            {busy
              ? "Memproses…"
              : mode === "approve"
                ? "Setujui"
                : mode === "reject"
                  ? "Tolak"
                  : "Batalkan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
