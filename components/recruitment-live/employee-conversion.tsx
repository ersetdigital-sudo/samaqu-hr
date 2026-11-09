"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JobApplication } from "@/lib/recruitment/live/types";
import { Modal } from "./ui";

/** Tombol/badge konversi; satu sumber untuk semua tampilan detail pelamar. */
export function EmployeeConversionAction({
  application,
  canConvert,
}: {
  application: JobApplication;
  canConvert: boolean;
}) {
  if (application.employee_id) {
    return (
      <div className="rl-stack" style={{ gap: 6 }}>
        <span className="rl-muted" style={{ fontSize: 12, fontWeight: 600 }}>
          Status karyawan
        </span>
        <div className="rl-row" style={{ alignItems: "center" }}>
          <span className="tag t-ok">Sudah menjadi karyawan</span>
          <Link
            prefetch={false}
            href={`/employees/direktori?employee=${encodeURIComponent(application.employee_id)}`}
            className="rl-btn rl-small"
          >
            Lihat profil
          </Link>
        </div>
      </div>
    );
  }

  if (!canConvert || application.stage !== "Diterima") return null;

  return (
    <div className="rl-stack" style={{ gap: 6 }}>
      <span className="rl-muted" style={{ fontSize: 12, fontWeight: 600 }}>
        Pelamar diterima
      </span>
      <Link
        prefetch={false}
        href={`/employees/direktori?convert=${encodeURIComponent(application.id)}`}
        className="rl-btn rl-primary"
      >
        Jadikan Karyawan
      </Link>
    </div>
  );
}

/** Dialog singkat setelah pelamar masuk tahap Diterima. */
export function EmployeeConversionPrompt({
  applicationId,
  open,
  onClose,
}: {
  applicationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!open) return null;

  return (
    <Modal title="Pelamar diterima" onClose={onClose}>
      <p className="rl-dialog-body">
        Lengkapi data karyawan sekarang, atau lanjutkan nanti dari detail
        pelamar.
      </p>
      <div className="rl-dialog-footer">
        <button type="button" className="rl-btn" onClick={onClose}>
          Nanti saja
        </button>
        <button
          type="button"
          className="rl-btn rl-primary"
          onClick={() => {
            onClose();
            router.push(
              `/employees/direktori?convert=${encodeURIComponent(applicationId)}`,
            );
          }}
        >
          Lengkapi data karyawan sekarang
        </button>
      </div>
    </Modal>
  );
}
