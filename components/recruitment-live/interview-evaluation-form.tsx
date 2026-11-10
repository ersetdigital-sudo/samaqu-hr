"use client";

import { useState } from "react";
import {
  INTERVIEW_RECOMMENDATIONS,
  type FieldErrors,
  type InterviewEvaluationInput,
  type InterviewRecommendation,
  type InterviewSchedule,
} from "@/lib/recruitment/live/types";
import { evaluationErrors } from "@/lib/recruitment/live/interview-validation";
import { ErrorBox, Modal } from "./ui";

const CRITERIA = [
  ["score_communication", "Komunikasi"],
  ["score_attitude", "Sikap & etika kerja"],
  ["score_skill", "Kemampuan kerja"],
  ["score_team_fit", "Kecocokan dengan tim"],
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

const formatAverage = (total: number) =>
  (Math.round((total / 4) * 100) / 100).toFixed(2).replace(".", ",");

export function InterviewEvaluationForm({
  interview,
  onClose,
  onSaved,
}: {
  interview: InterviewSchedule;
  onClose: () => void;
  onSaved: (interview: InterviewSchedule) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({
    score_communication: interview.score_communication ?? 3,
    score_attitude: interview.score_attitude ?? 3,
    score_skill: interview.score_skill ?? 3,
    score_team_fit: interview.score_team_fit ?? 3,
  });
  const [recommendation, setRecommendation] = useState<InterviewRecommendation>(
    interview.recommendation ?? INTERVIEW_RECOMMENDATIONS[0],
  );
  const [comments, setComments] = useState(interview.comments ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);

  const submit = async () => {
    const payload: InterviewEvaluationInput = {
      score_communication: scores.score_communication,
      score_attitude: scores.score_attitude,
      score_skill: scores.score_skill,
      score_team_fit: scores.score_team_fit,
      recommendation,
      comments: comments.trim(),
    };
    const nextErrors = evaluationErrors(payload);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/recruitment/interviews/${interview.id}/evaluation`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        interview?: InterviewSchedule;
        error?: string;
        errors?: FieldErrors;
      } | null;

      if (!response.ok || !data?.interview) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error ?? "Gagal menyimpan evaluasi");
      }
      onSaved(data.interview);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Gagal menyimpan evaluasi",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Evaluasi Wawancara · Ronde ${interview.round_number}`}
      onClose={onClose}
      busy={saving}
    >
      {formError && <ErrorBox message={formError} />}
      <p className="rl-dialog-body" style={{ marginBottom: 14 }}>
        {interview.applicant_name} · {interview.job_title}
      </p>
      <div className="rl-score-grid">
        {CRITERIA.map(([key, label]) => (
          <div className="rl-field" key={key}>
            <label htmlFor={`eval-${key}`}>{label}</label>
            <select
              id={`eval-${key}`}
              className="rl-input"
              value={scores[key]}
              onChange={(event) =>
                setScores((current) => ({
                  ...current,
                  [key]: Number(event.target.value),
                }))
              }
              aria-invalid={Boolean(errors[key])}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <FieldError message={errors[key]} />
          </div>
        ))}
      </div>
      <div className="rl-average mt-4">
        <span>Rata-rata nilai</span>
        <span>{formatAverage(total)} / 5</span>
      </div>
      <div className="rl-field mt-4">
        <label htmlFor="eval-recommendation">Rekomendasi</label>
        <select
          id="eval-recommendation"
          className="rl-input"
          value={recommendation}
          onChange={(event) =>
            setRecommendation(event.target.value as InterviewRecommendation)
          }
          aria-invalid={Boolean(errors.recommendation)}
        >
          {INTERVIEW_RECOMMENDATIONS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <FieldError message={errors.recommendation} />
      </div>
      <div className="rl-field mt-4">
        <label htmlFor="eval-comments">Catatan evaluasi</label>
        <textarea
          id="eval-comments"
          rows={3}
          maxLength={2000}
          className="rl-input"
          value={comments}
          onChange={(event) => setComments(event.target.value)}
        />
        <FieldError message={errors.comments} />
      </div>
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
          disabled={saving}
        >
          {saving ? "Menyimpan…" : "Simpan Evaluasi"}
        </button>
      </div>
    </Modal>
  );
}
