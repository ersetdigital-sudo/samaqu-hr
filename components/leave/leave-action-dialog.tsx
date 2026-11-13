"use client";

import { useEffect, useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import "@/components/recruitment-live/live.css";

/** Dialog alasan wajib untuk tolak / batalkan cuti yang sudah disetujui. */
export function LeaveActionDialog({
  open,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  danger = false,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setLocalError("");
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!reason.trim()) {
      setLocalError(`${label} wajib diisi.`);
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="rl">
      <Modal title={title} onClose={onClose} busy={busy}>
        <p className="rl-dialog-body">{description}</p>
        {error && <ErrorBox message={error} />}
        <div className="rl-field mt-3">
          <label htmlFor="leave-action-reason">{label} *</label>
          <textarea
            id="leave-action-reason"
            className="rl-input"
            rows={3}
            maxLength={1000}
            placeholder={placeholder}
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
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </Modal>
    </div>
  );
}
