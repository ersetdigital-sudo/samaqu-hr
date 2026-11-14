"use client";

import { useEffect, useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import "@/components/recruitment-live/live.css";

export function PayrollReasonDialog({
  open,
  title,
  description,
  label,
  confirmLabel,
  busy,
  error,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  busy: boolean;
  error?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setLocalError("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="rl">
      <Modal title={title} onClose={onClose} busy={busy}>
        <p className="rl-dialog-body">{description}</p>
        {error && <ErrorBox message={error} />}
        <div className="rl-field mt-3">
          <label htmlFor="payroll-reason">{label} *</label>
          <textarea
            id="payroll-reason"
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
            <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
              {localError}
            </div>
          )}
        </div>
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
            className={`rl-btn ${danger ? "rl-danger" : "rl-primary"}`}
            onClick={() => {
              if (!reason.trim()) {
                setLocalError("Alasan wajib diisi.");
                return;
              }
              onConfirm(reason.trim());
            }}
            disabled={busy}
          >
            {busy ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </Modal>
    </div>
  );
}
