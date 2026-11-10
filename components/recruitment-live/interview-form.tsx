"use client";

import { useState } from "react";
import {
  INTERVIEW_MODES,
  type FieldErrors,
  type InterviewInput,
  type InterviewMode,
  type InterviewSchedule,
} from "@/lib/recruitment/live/types";
import { interviewErrors } from "@/lib/recruitment/live/interview-validation";
import { ErrorBox, Modal } from "./ui";

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

export function InterviewForm({
  applicationId,
  interview,
  onClose,
  onSaved,
}: {
  applicationId: string;
  interview: InterviewSchedule | null;
  onClose: () => void;
  onSaved: (interview: InterviewSchedule, warning: string | null) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState(
    interview ? toLocalInput(interview.scheduled_at) : "",
  );
  const [duration, setDuration] = useState(
    String(interview?.duration_minutes ?? 60),
  );
  const [mode, setMode] = useState<InterviewMode>(
    interview?.mode ?? INTERVIEW_MODES[0],
  );
  const [location, setLocation] = useState(interview?.location_or_link ?? "");
  const [interviewer, setInterviewer] = useState(
    interview?.interviewer_name ?? "",
  );
  const [notes, setNotes] = useState(interview?.notes ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    let iso = "";
    if (scheduledAt) {
      const parsed = new Date(scheduledAt);
      if (!Number.isNaN(parsed.getTime())) iso = parsed.toISOString();
    }
    const payload: InterviewInput = {
      scheduled_at: iso,
      duration_minutes: Number(duration),
      mode,
      location_or_link: location.trim(),
      interviewer_name: interviewer.trim(),
      notes: notes.trim(),
    };
    const nextErrors = interviewErrors(payload);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const response = await fetch(
        interview
          ? `/api/recruitment/interviews/${interview.id}`
          : "/api/recruitment/interviews",
        {
          method: interview ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            interview ? payload : { ...payload, application_id: applicationId },
          ),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        interview?: InterviewSchedule;
        warning?: string | null;
        error?: string;
        errors?: FieldErrors;
      } | null;

      if (!response.ok || !data?.interview) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error ?? "Gagal menyimpan jadwal wawancara");
      }
      onSaved(data.interview, data.warning ?? null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan jadwal wawancara",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={interview ? "Ubah Jadwal Wawancara" : "Jadwalkan Wawancara"}
      onClose={onClose}
      busy={saving}
    >
      {formError && <ErrorBox message={formError} />}
      <div className="rl-fields-grid">
        <div className="rl-field">
          <label htmlFor="interview-date">Tanggal &amp; jam *</label>
          <input
            id="interview-date"
            type="datetime-local"
            className="rl-input"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            aria-invalid={Boolean(errors.scheduled_at)}
          />
          <FieldError message={errors.scheduled_at} />
        </div>
        <div className="rl-field">
          <label htmlFor="interview-duration">Durasi (menit) *</label>
          <input
            id="interview-duration"
            type="number"
            min={15}
            max={480}
            step={15}
            className="rl-input"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            aria-invalid={Boolean(errors.duration_minutes)}
          />
          <FieldError message={errors.duration_minutes} />
        </div>
        <div className="rl-field">
          <label htmlFor="interview-mode">Jenis *</label>
          <select
            id="interview-mode"
            className="rl-input"
            value={mode}
            onChange={(event) => setMode(event.target.value as InterviewMode)}
          >
            {INTERVIEW_MODES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <FieldError message={errors.mode} />
        </div>
        <div className="rl-field">
          <label htmlFor="interview-interviewer">Nama pewawancara *</label>
          <input
            id="interview-interviewer"
            className="rl-input"
            maxLength={150}
            value={interviewer}
            onChange={(event) => setInterviewer(event.target.value)}
            aria-invalid={Boolean(errors.interviewer_name)}
          />
          <FieldError message={errors.interviewer_name} />
        </div>
        <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="interview-location">Lokasi atau link *</label>
          <input
            id="interview-location"
            className="rl-input"
            maxLength={500}
            placeholder="cth. Kantor SAMAQU Bandung / https://meet.example.com/..."
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            aria-invalid={Boolean(errors.location_or_link)}
          />
          <FieldError message={errors.location_or_link} />
        </div>
        <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="interview-notes">Catatan</label>
          <textarea
            id="interview-notes"
            rows={2}
            maxLength={2000}
            className="rl-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <FieldError message={errors.notes} />
        </div>
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
          {saving ? "Menyimpan…" : "Simpan Jadwal"}
        </button>
      </div>
    </Modal>
  );
}
