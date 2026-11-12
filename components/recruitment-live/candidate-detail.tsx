"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecruitment } from "@/components/recruitment-provider";
import type {
  CandidateApplication,
  JobApplication,
} from "@/lib/recruitment/live/types";
import {
  cvRetentionWarningAt,
  formatRetentionDate,
} from "@/lib/recruitment/live/retention";
import {
  api,
  Badge,
  ConfirmDialog,
  ErrorBox,
  Icon,
  initials,
  Modal,
  relativeTime,
  StageConfirmDialog,
  whatsappDigits,
} from "./ui";
import { useApplicationNotes } from "./use-application-notes";
import {
  applicationDetailItems,
  NEXT_STAGE_LABELS,
  nextStageFor,
} from "./application-detail-model";
import {
  EmployeeConversionAction,
  EmployeeConversionPrompt,
} from "./employee-conversion";
import { InterviewSection } from "./interview-section";
import { StageHistory } from "./stage-history";
import { ApplicationContactForm } from "./application-contact-form";
import { ApplicationDataHistory } from "./application-data-history";
import { contactFromApplication } from "@/lib/recruitment/live/contact";

/** Detail pelamar lintas lowongan: CV, catatan, dan perubahan tahap. */
export function CandidateDetailModal({
  application,
  canConvert,
  onPatch,
  onClose,
}: {
  application: CandidateApplication;
  canConvert: boolean;
  onPatch: (id: string, patch: Partial<JobApplication>) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [stageBusy, setStageBusy] = useState(false);
  const [stageError, setStageError] = useState("");
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reject, setReject] = useState(false);
  const [conversionTarget, setConversionTarget] =
    useState<JobApplication | null>(null);

  useEffect(() => {
    setEditOpen(false);
  }, [application.id]);
  const notes = useApplicationNotes((id, note) => {
    onPatch(id, { internal_note: note });
  });
  const retentionWarning = application.job
    ? cvRetentionWarningAt(application, application.job)
    : null;
  const nextStage = nextStageFor(application.stage);
  const detail = applicationDetailItems(application);

  async function changeStage(stage: string) {
    if (stageBusy) return;
    setStageBusy(true);
    setStageError("");
    try {
      if (!(await notes.flush())) {
        setStageError(
          "Catatan belum tersimpan. Coba lagi sebelum memindah tahap.",
        );
        toast("Gagal memindah tahap: catatan belum tersimpan.");
        return;
      }
      const result = await api<{ application: JobApplication }>(
        `/api/recruitment/applications/${application.id}`,
        { method: "PATCH", body: JSON.stringify({ stage }) },
      );
      onPatch(application.id, {
        stage: result.application.stage,
        rejected_at: result.application.rejected_at,
        cv_deleted_at: result.application.cv_deleted_at,
      });
      setReject(false);
      setPendingStage(null);
      toast(`${application.full_name} dipindah ke ${stage}`);
      if (
        canConvert &&
        result.application.stage === "Diterima" &&
        !result.application.employee_id
      )
        setConversionTarget(result.application);
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Tahap pelamar gagal diperbarui.";
      setStageError(message);
      toast(`Gagal memindah tahap: ${message}`);
    } finally {
      setStageBusy(false);
    }
  }

  function close() {
    if (stageBusy) return;
    void notes.flush().then((saved) => {
      if (saved) onClose();
    });
  }

  return (
    <>
      <Modal title="Detail Pelamar" onClose={close} busy={stageBusy}>
        <div className="rl-stack rl-detail" style={{ gap: 18 }}>
          <div className="rl-detail-top">
            <span className="rl-avatar rl-avatar-large">
              {initials(application.full_name)}
            </span>
            <div className="rl-stack" style={{ flex: 1, gap: 4 }}>
              <h2>{application.full_name}</h2>
              <span className="rl-muted">
                {application.job?.title ?? "Lowongan"} · Melamar{" "}
                <time
                  dateTime={application.created_at}
                  suppressHydrationWarning
                >
                  {relativeTime(application.created_at)}
                </time>
              </span>
            </div>
            <Badge value={application.stage} />
          </div>

          {stageError && !reject && <ErrorBox message={stageError} />}
          {notes.status === "error" && (
            <ErrorBox
              message={`Catatan belum tersimpan: ${notes.error}`}
              retry={() => void notes.flush()}
            />
          )}

          <div className="rl-stack" style={{ gap: 6 }}>
            <div className="rl-two">
              <a
                href={`https://wa.me/${whatsappDigits(application.whatsapp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rl-btn rl-green"
              >
                <Icon name="chat" />
                Chat WhatsApp
              </a>
              {application.cv_deleted_at ? (
                <div className="rl-cv-deleted">
                  {new Date(application.cv_deleted_at).getTime() <= Date.now()
                    ? "CV sudah dihapus pada "
                    : "CV dihapus otomatis pada "}
                  {formatRetentionDate(application.cv_deleted_at)}
                </div>
              ) : (
                <a
                  href={`/api/recruitment/applications/${application.id}/cv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rl-btn"
                >
                  <Icon name="file" />
                  Buka CV
                </a>
              )}
            </div>
            {retentionWarning && (
              <p className="rl-retention">
                CV akan dihapus otomatis pada{" "}
                {formatRetentionDate(retentionWarning)}
              </p>
            )}
          </div>

          <EmployeeConversionAction
            application={application}
            canConvert={canConvert}
          />

          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-[13px]">Data Pelamar</span>
            <button
              type="button"
              className="btn btn-g !py-1 !px-3 !text-[11px]"
              onClick={() => setEditOpen(true)}
              disabled={Boolean(application.employee_id)}
              title={
                application.employee_id
                  ? "Data sudah menjadi data karyawan, koreksi lewat Direktori Karyawan"
                  : "Ubah data pelamar"
              }
            >
              Ubah Data
            </button>
          </div>
          {application.employee_id && (
            <p className="text-[11px] sub">
              Data sudah menjadi data karyawan, koreksi lewat Direktori
              Karyawan.
            </p>
          )}

          <dl className="rl-details-grid">
            {detail.map(([label, value, wide]) => (
              <div key={label} className={wide ? "rl-span-two" : undefined}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div
            className="rl-row"
            style={{ justifyContent: "space-between", fontSize: 12.5 }}
          >
            <span className="rl-muted">{application.application_number}</span>
            <a
              href={`mailto:${application.email}`}
              style={{ overflowWrap: "anywhere" }}
            >
              {application.email}
            </a>
            {/^https?:\/\//i.test(application.portfolio_url) && (
              <a
                href={application.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rl-btn rl-small"
              >
                <Icon name="external" />
                Portofolio
              </a>
            )}
          </div>

          <div className="rl-motivation">
            <span
              className="rl-muted"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Kenapa cocok di posisi ini
            </span>
            <p>{application.motivation || "Tidak diisi oleh pelamar."}</p>
          </div>

          <StageHistory
            applicationId={application.id}
            stage={application.stage}
          />

          <ApplicationDataHistory
            applicationId={application.id}
            version={`${application.full_name}|${application.whatsapp}|${application.email}|${application.city}`}
          />

          <InterviewSection applicationId={application.id} onFlowSaved={close} />

          <div className="rl-field">
            <label htmlFor="internal-note">
              Catatan internal (tidak terlihat pelamar)
            </label>
            <textarea
              id="internal-note"
              rows={2}
              maxLength={10000}
              className="rl-input"
              placeholder="Contoh: Komunikasi bagus, cek ulang pengalaman Shopee"
              value={notes.value(application)}
              onChange={(event) => notes.edit(application, event.target.value)}
              onBlur={() => void notes.flush()}
              aria-describedby="note-status"
            />
            <span
              id="note-status"
              className={notes.status === "error" ? "rl-error" : "rl-muted"}
              role="status"
            >
              {notes.status === "saving"
                ? "Menyimpan catatan…"
                : notes.status === "dirty"
                  ? "Perubahan belum tersimpan…"
                  : notes.status === "error"
                    ? "Catatan belum tersimpan. Coba lagi sebelum berpindah."
                    : "Catatan tersimpan otomatis"}
            </span>
          </div>

          <div className="rl-stage-actions">
            {application.stage !== "Diterima" &&
              application.stage !== "Ditolak" && (
                <button
                  type="button"
                  className="rl-btn rl-danger"
                  disabled={stageBusy}
                  onClick={() => {
                    setStageError("");
                    setPendingStage(null);
                    setReject(true);
                  }}
                >
                  Tolak
                </button>
              )}
            <button
              type="button"
              className="rl-btn rl-primary"
              disabled={
                stageBusy || !nextStage || application.stage === "Diterima"
              }
              onClick={() => {
                if (!nextStage) return;
                setStageError("");
                setReject(false);
                setPendingStage(nextStage);
              }}
            >
              {stageBusy
                ? "Memproses…"
                : application.stage === "Diterima"
                  ? "Sudah Diterima"
                  : NEXT_STAGE_LABELS[application.stage] || "Tahap selesai"}
            </button>
          </div>
        </div>
      </Modal>

      <EmployeeConversionPrompt
        applicationId={conversionTarget?.id ?? ""}
        open={Boolean(conversionTarget)}
        onClose={() => setConversionTarget(null)}
      />

      {reject && (
        <ConfirmDialog
          title="Tolak lamaran?"
          description={`Lamaran ${application.full_name} akan dipindahkan ke tahap Ditolak. Kamu dapat memulihkannya nanti.`}
          confirmLabel="Tolak Lamaran"
          danger
          busy={stageBusy}
          error={stageError || (notes.status === "error" ? notes.error : "")}
          onClose={() => setReject(false)}
          onConfirm={() => void changeStage("Ditolak")}
        />
      )}

      {pendingStage && (
        <StageConfirmDialog
          applicationName={application.full_name}
          from={application.stage}
          to={pendingStage}
          busy={stageBusy}
          error={stageError}
          onClose={() => {
            if (!stageBusy) setPendingStage(null);
          }}
          onConfirm={() => void changeStage(pendingStage)}
        />
      )}

      {editOpen && (
        <ApplicationContactForm
          applicationId={application.id}
          initial={contactFromApplication(application)}
          onClose={() => setEditOpen(false)}
          onSaved={(contact) => {
            onPatch(application.id, contact);
            setEditOpen(false);
            toast("Data pelamar diperbarui");
          }}
        />
      )}
    </>
  );
}
