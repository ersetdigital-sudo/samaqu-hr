"use client";

import { useEffect, useState } from "react";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  buildInterviewInvitation,
  formatInterviewDate,
  formatInterviewTime,
} from "@/lib/recruitment/live/invitation";
import {
  cachedApplicationInterviews,
  invalidateApplicationInterviews,
  loadApplicationInterviews,
} from "@/lib/recruitment/live/interview-cache";
import type {
  InterviewSchedule,
  InterviewStatus,
} from "@/lib/recruitment/live/types";
import { ConfirmDialog, ErrorBox } from "./ui";
import { InterviewEvaluationForm } from "./interview-evaluation-form";
import { InterviewForm } from "./interview-form";

const statusTone: Record<InterviewStatus, string> = {
  Dijadwalkan: "t-warn",
  Selesai: "t-ok",
  Dibatalkan: "t-mute",
  "Tidak hadir": "t-bad",
};

const byRound = (a: InterviewSchedule, b: InterviewSchedule) =>
  a.round_number - b.round_number;

const formatAverage = (value: number) =>
  value.toFixed(2).replace(".", ",");

export function InterviewSection({
  applicationId,
  onFlowSaved,
}: {
  applicationId: string;
  onFlowSaved?: () => void;
}) {
  const { toast } = useRecruitment();
  const [interviews, setInterviews] = useState<InterviewSchedule[]>(
    () => cachedApplicationInterviews(applicationId) ?? [],
  );
  const [loading, setLoading] = useState(
    () => !cachedApplicationInterviews(applicationId),
  );
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<"new" | InterviewSchedule | null>(null);
  const [evalTarget, setEvalTarget] = useState<InterviewSchedule | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InterviewSchedule | null>(
    null,
  );
  const [finishTarget, setFinishTarget] = useState<InterviewSchedule | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let active = true;
    const cached = cachedApplicationInterviews(applicationId);
    if (cached) {
      setInterviews(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    loadApplicationInterviews(applicationId)
      .then((rows) => {
        if (active) setInterviews(rows);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Jadwal wawancara belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applicationId, reloadKey]);

  useEffect(() => {
    setForm(null);
    setEvalTarget(null);
    setCancelTarget(null);
    setNotice("");
    setActionError("");
  }, [applicationId]);

  const replaceInterview = (updated: InterviewSchedule) => {
    invalidateApplicationInterviews(applicationId);
    setInterviews((current) =>
      current
        .map((item) => (item.id === updated.id ? updated : item))
        .sort(byRound),
    );
  };

  const changeStatus = async (
    interview: InterviewSchedule,
    status: InterviewStatus,
  ) => {
    if (busyId) return;
    setBusyId(interview.id);
    setStatusError("");
    try {
      const response = await fetch(
        `/api/recruitment/interviews/${interview.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        interview?: InterviewSchedule;
        error?: string;
      } | null;
      if (!response.ok || !data?.interview)
        throw new Error(data?.error ?? "Status wawancara gagal diperbarui");

      replaceInterview(data.interview);
      setCancelTarget(null);
      setFinishTarget(null);
      toast(
        status === "Selesai"
          ? "Wawancara ditandai Selesai"
          : status === "Tidak hadir"
            ? "Wawancara ditandai Tidak hadir"
            : "Jadwal wawancara dibatalkan",
      );
    } catch (cause) {
      setStatusError(
        cause instanceof Error
          ? cause.message
          : "Status wawancara gagal diperbarui",
      );
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Status wawancara gagal diperbarui",
      );
    } finally {
      setBusyId(null);
    }
  };

  const copyInvitation = async (interview: InterviewSchedule) => {
    try {
      await navigator.clipboard.writeText(
        buildInterviewInvitation(interview),
      );
      toast("Pesan undangan disalin.");
    } catch {
      setActionError(
        "Pesan undangan tidak bisa disalin. Pilih dan salin manual dari detail jadwal.",
      );
    }
  };

  return (
    <section className="rl-interviews" aria-label="Jadwal dan evaluasi wawancara">
      <div className="rl-row" style={{ justifyContent: "space-between" }}>
        <h2>Jadwal &amp; Evaluasi</h2>
        <button
          type="button"
          className="rl-btn rl-primary"
          onClick={() => setForm("new")}
        >
          Jadwalkan wawancara
        </button>
      </div>

      {notice && (
        <div className="rl-warning" role="status">
          <strong>Perhatian jadwal</strong>
          <span>{notice}</span>
        </div>
      )}
      {actionError && !cancelTarget && <ErrorBox message={actionError} />}
      {loading && (
        <p className="rl-muted" role="status">
          Memuat jadwal wawancara…
        </p>
      )}
      {error && !loading && (
        <ErrorBox message={error} retry={() => setReloadKey((key) => key + 1)} />
      )}
      {!loading && !error && interviews.length === 0 && (
        <p className="rl-muted">
          Belum ada jadwal wawancara. Jadwalkan wawancara pertama untuk pelamar
          ini.
        </p>
      )}

      {interviews.map((interview) => (
        <article className="rl-interview-item" key={interview.id}>
          <div className="rl-interview-head">
            <div className="rl-row" style={{ alignItems: "center" }}>
              <strong>Ronde {interview.round_number}</strong>
              <span className={`tag ${statusTone[interview.status]}`}>
                {interview.status}
              </span>
            </div>
            <span className="rl-muted text-[12px]">
              {formatInterviewDate(interview.scheduled_at)} ·{" "}
              {formatInterviewTime(interview.scheduled_at)} WIB ·{" "}
              {interview.duration_minutes} menit
            </span>
          </div>
          <div className="rl-interview-meta">
            {interview.mode} · {interview.location_or_link} · Pewawancara:{" "}
            {interview.interviewer_name}
          </div>
          {interview.notes && (
            <div className="rl-interview-meta">{interview.notes}</div>
          )}
          {interview.average_score !== null && (
            <div className="rl-interview-score">
              Rata-rata nilai <b>{formatAverage(interview.average_score)}</b>
              {interview.recommendation
                ? ` · Rekomendasi ${interview.recommendation}`
                : ""}
            </div>
          )}
          <div className="rl-interview-actions">
            <button
              type="button"
              className="rl-btn rl-small"
              onClick={() => void copyInvitation(interview)}
            >
              Salin pesan undangan
            </button>
            {interview.status === "Dijadwalkan" && (
              <>
                <button
                  type="button"
                  className="rl-btn rl-small"
                  onClick={() => setForm(interview)}
                  disabled={Boolean(busyId)}
                >
                  Ubah jadwal
                </button>
                <button
                  type="button"
                  className="rl-btn rl-small rl-primary"
                  onClick={() => {
                    if (
                      new Date(interview.scheduled_at).getTime() > Date.now()
                    ) {
                      setStatusError("");
                      setFinishTarget(interview);
                      return;
                    }
                    void changeStatus(interview, "Selesai");
                  }}
                  disabled={Boolean(busyId)}
                >
                  Tandai Selesai
                </button>
                <button
                  type="button"
                  className="rl-btn rl-small"
                  onClick={() => void changeStatus(interview, "Tidak hadir")}
                  disabled={Boolean(busyId)}
                >
                  Tidak hadir
                </button>
                <button
                  type="button"
                  className="rl-btn rl-small rl-danger"
                  onClick={() => {
                    setStatusError("");
                    setCancelTarget(interview);
                  }}
                  disabled={Boolean(busyId)}
                >
                  Batalkan
                </button>
              </>
            )}
            {interview.status === "Selesai" && (
              <button
                type="button"
                className="rl-btn rl-small rl-primary"
                onClick={() => setEvalTarget(interview)}
                disabled={Boolean(busyId)}
              >
                {interview.evaluation_id ? "Edit evaluasi" : "Isi evaluasi"}
              </button>
            )}
          </div>
        </article>
      ))}

      {form && (
        <InterviewForm
          applicationId={applicationId}
          interview={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={(interview, warning) => {
            invalidateApplicationInterviews(applicationId);
            setInterviews((current) =>
              [
                ...current.filter((item) => item.id !== interview.id),
                interview,
              ].sort(byRound),
            );
            setForm(null);
            setNotice(warning ?? "");
            const message =
              form === "new"
                ? "Jadwal wawancara dibuat"
                : "Jadwal wawancara diperbarui";
            toast(warning ? `${message}. ${warning}` : message);
            onFlowSaved?.();
          }}
        />
      )}

      {evalTarget && (
        <InterviewEvaluationForm
          interview={evalTarget}
          onClose={() => setEvalTarget(null)}
          onSaved={(interview) => {
            replaceInterview(interview);
            setEvalTarget(null);
            toast("Evaluasi wawancara disimpan");
            onFlowSaved?.();
          }}
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Batalkan jadwal?"
          description={`Jadwal ronde ${cancelTarget.round_number} pada ${formatInterviewDate(cancelTarget.scheduled_at)} ${formatInterviewTime(cancelTarget.scheduled_at)} WIB akan ditandai Dibatalkan.`}
          confirmLabel="Batalkan Jadwal"
          danger
          busy={busyId === cancelTarget.id}
          error={statusError}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => void changeStatus(cancelTarget, "Dibatalkan")}
        />
      )}

      {finishTarget && (
        <ConfirmDialog
          title="Tandai selesai?"
          description={`Jadwal ronde ${finishTarget.round_number} pada ${formatInterviewDate(finishTarget.scheduled_at)} ${formatInterviewTime(finishTarget.scheduled_at)} WIB belum dimulai. Tandai selesai sekarang?`}
          confirmLabel="Ya, tandai selesai"
          busy={busyId === finishTarget.id}
          error={statusError}
          onClose={() => setFinishTarget(null)}
          onConfirm={() => void changeStatus(finishTarget, "Selesai")}
        />
      )}
    </section>
  );
}
