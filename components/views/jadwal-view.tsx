"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { CandidateDetailModal } from "@/components/recruitment-live/candidate-detail";
import { ErrorBox } from "@/components/recruitment-live/ui";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import {
  cachedCandidateApplication,
  loadCandidateApplication,
} from "@/lib/recruitment/live/application-cache";
import { formatInterviewTime } from "@/lib/recruitment/live/invitation";
import {
  INTERVIEW_STATUSES,
  type CandidateApplication,
  type InterviewSchedule,
  type InterviewStatus,
  type JobApplication,
} from "@/lib/recruitment/live/types";
import "@/components/recruitment-live/live.css";

const statusTone: Record<InterviewStatus, string> = {
  Dijadwalkan: "t-warn",
  Selesai: "t-ok",
  Dibatalkan: "t-mute",
  "Tidak hadir": "t-bad",
};

const shortDate = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
});

const isUpcoming = (interview: InterviewSchedule, now: number) =>
  interview.status === "Dijadwalkan" &&
  new Date(interview.scheduled_at).getTime() >= now;

export function JadwalView({
  initial,
  initialError,
  canConvert,
}: {
  initial: InterviewSchedule[] | null;
  initialError?: string;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [interviews, setInterviews] = useState(initial ?? []);
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [selected, setSelected] = useState<CandidateApplication | null>(null);
  const [detailBusyId, setDetailBusyId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    setInterviews(initial ?? []);
  }, [initial]);

  const jobs = useMemo(() => {
    const unique = new Map<string, string>();
    for (const interview of interviews)
      unique.set(interview.job_id, interview.job_title);
    return [...unique.entries()].map(([id, title]) => ({ id, title }));
  }, [interviews]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return interviews.filter(
      (interview) =>
        (jobFilter === "Semua" || interview.job_id === jobFilter) &&
        (statusFilter === "Semua" || interview.status === statusFilter) &&
        (!term ||
          interview.applicant_name.toLowerCase().includes(term) ||
          interview.job_title.toLowerCase().includes(term) ||
          interview.interviewer_name.toLowerCase().includes(term)),
    );
  }, [interviews, query, jobFilter, statusFilter]);

  const upcoming = filtered.filter((item) => isUpcoming(item, now));
  const past = filtered.filter((item) => !isUpcoming(item, now));

  async function openDetail(interview: InterviewSchedule) {
    setDetailError("");
    const cached = cachedCandidateApplication(interview.application_id);
    if (cached) {
      setSelected(cached);
      return;
    }
    setDetailBusyId(interview.id);
    try {
      setSelected(await loadCandidateApplication(interview.application_id));
    } catch (cause) {
      setDetailError(
        cause instanceof Error
          ? cause.message
          : "Detail pelamar belum dapat dimuat.",
      );
    } finally {
      setDetailBusyId(null);
    }
  }

  function patchApplication(id: string, changes: Partial<JobApplication>) {
    setSelected((current) =>
      current && current.id === id ? { ...current, ...changes } : current,
    );
  }

  function closeDetail() {
    setSelected(null);
    router.refresh();
  }

  const columns: DataTableColumn<InterviewSchedule>[] = [
    {
      key: "waktu",
      label: "Waktu",
      width: "22%",
      render: (interview) => (
        <TwoLineCell
          primary={shortDate.format(new Date(interview.scheduled_at))}
          secondary={`${formatInterviewTime(interview.scheduled_at)} WIB · ${interview.duration_minutes} mnt · Ronde ${interview.round_number}`}
        />
      ),
    },
    {
      key: "kandidat",
      label: "Kandidat",
      width: "28%",
      render: (interview) => (
        <TwoLineCell
          primary={interview.applicant_name}
          secondary={interview.job_title}
        />
      ),
    },
    {
      key: "pewawancara",
      label: "Pewawancara",
      width: "20%",
      render: (interview) => (
        <TwoLineCell
          primary={interview.interviewer_name}
          secondary={interview.mode}
        />
      ),
    },
    {
      key: "nilai",
      label: "Nilai",
      width: "14%",
      render: (interview) =>
        interview.average_score !== null ? (
          <TwoLineCell
            primary={`${interview.average_score.toFixed(2).replace(".", ",")} / 5`}
            secondary={interview.recommendation ?? undefined}
          />
        ) : (
          <span className="sub">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      width: "16%",
      render: (interview) => (
        <span className={`tag ${statusTone[interview.status]}`}>
          {interview.status}
        </span>
      ),
    },
  ];

  const emptyText = interviews.length
    ? "Tidak ada jadwal yang cocok dengan filter."
    : "Belum ada jadwal wawancara. Buka detail pelamar untuk menjadwalkan wawancara pertama.";

  const table = (rows: InterviewSchedule[], label: string) => (
    <DataTable
      ariaLabel={label}
      columns={columns}
      rows={rows}
      rowKey={(interview) => interview.id}
      rowLabel={(interview) =>
        `Lihat detail pelamar ${interview.applicant_name}`
      }
      onRowActivate={(interview) => void openDetail(interview)}
      onRowPrefetch={(interview) => {
        void loadCandidateApplication(interview.application_id).catch(
          () => undefined,
        );
      }}
      empty={emptyText}
    />
  );

  return (
    <div className="rl">
      <PageHead
        title="Jadwal & Evaluasi"
        subtitle="Jadwal wawancara dan evaluasi kandidat. Klik baris untuk membuka detail pelamar."
      >
        <span className="sub text-[13px]">
          {interviews.length} jadwal wawancara
        </span>
      </PageHead>

      {!initial ? (
        <ErrorBox
          message={
            initialError ??
            "Jadwal wawancara belum dapat dimuat. Silakan coba lagi."
          }
          retry={() => router.refresh()}
        />
      ) : (
        <div className="rl-stack" style={{ gap: 18 }}>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full md:w-80">
              <input
                className="inp inp-search"
                placeholder="Cari kandidat, lowongan, atau pewawancara…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Icon name="search" className="search-icon" />
            </div>
            <select
              className="inp !w-auto"
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
              aria-label="Filter lowongan"
            >
              <option value="Semua">Semua lowongan</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
            <select
              className="inp !w-auto"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter status"
            >
              {["Semua", ...INTERVIEW_STATUSES].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {detailError && <ErrorBox message={detailError} />}
          {detailBusyId && (
            <p className="rl-muted" role="status">
              Memuat detail pelamar…
            </p>
          )}

          <div className="card">
            <div
              className="px-6 py-4 border-b font-bold text-[14px]"
              style={{ borderColor: "var(--line)" }}
            >
              Mendatang ({upcoming.length})
            </div>
            {table(upcoming, "Jadwal wawancara mendatang")}
          </div>

          <div className="card">
            <div
              className="px-6 py-4 border-b font-bold text-[14px]"
              style={{ borderColor: "var(--line)" }}
            >
              Sudah lewat / selesai ({past.length})
            </div>
            {table(past, "Jadwal wawancara sudah lewat atau selesai")}
          </div>
        </div>
      )}

      {selected && (
        <CandidateDetailModal
          application={selected}
          canConvert={canConvert}
          onPatch={patchApplication}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
