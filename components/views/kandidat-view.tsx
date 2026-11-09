"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { CandidateDetailModal } from "@/components/recruitment-live/candidate-detail";
import {
  Badge,
  ErrorBox,
  initials,
  relativeTime,
} from "@/components/recruitment-live/ui";
import { STAGES } from "@/lib/data";
import type {
  JobApplication,
  RecruitmentBoard,
} from "@/lib/recruitment/live/types";
import "@/components/recruitment-live/live.css";

export function KandidatView({
  initial,
  initialError,
}: {
  initial: RecruitmentBoard | null;
  initialError?: string;
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(
    initial?.applications ?? [],
  );
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("Semua");
  const [stageFilter, setStageFilter] = useState("Semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setApplications(initial?.applications ?? []);
  }, [initial]);

  const jobs = initial?.jobs ?? [];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return applications.filter(
      (application) =>
        (jobFilter === "Semua" || application.job_id === jobFilter) &&
        (stageFilter === "Semua" || application.stage === stageFilter) &&
        (!term ||
          application.full_name.toLowerCase().includes(term) ||
          application.city.toLowerCase().includes(term)),
    );
  }, [applications, query, jobFilter, stageFilter]);
  const selected = applications.find((item) => item.id === selectedId) ?? null;

  function patch(id: string, changes: Partial<JobApplication>) {
    setApplications((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  const total = initial?.total ?? 0;
  const countLabel =
    initial && initial.applications.length < total
      ? `Menampilkan ${initial.applications.length} dari ${total} pelamar terbaru`
      : `${total} pelamar`;

  return (
    <div className="rl">
      <PageHead
        title="Kandidat"
        subtitle="Seluruh pelamar lintas lowongan. Klik baris untuk melihat detail."
      >
        <span className="sub text-[13px]">{countLabel}</span>
      </PageHead>

      {!initial ? (
        <ErrorBox
          message={
            initialError ??
            "Daftar kandidat belum dapat dimuat. Silakan coba lagi."
          }
          retry={() => router.refresh()}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full md:w-80">
              <input
                id="cq"
                className="inp inp-search"
                placeholder="Cari nama atau domisili…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Icon name="search" className="search-icon" />
            </div>
            <select
              className="inp !w-auto"
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
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
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
            >
              {["Semua", ...STAGES].map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          <div className="card overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Kandidat</th>
                  <th>Lowongan</th>
                  <th>Tahap</th>
                  <th>Tanggal Melamar</th>
                  <th>Sumber</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((application) => (
                  <tr
                    key={application.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    aria-label={`Lihat detail ${application.full_name}`}
                    onClick={() => setSelectedId(application.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(application.id);
                      }
                    }}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="av">
                          {initials(application.full_name)}
                        </div>
                        <div>
                          <b>{application.full_name}</b>
                          <div className="sub text-[12px]">
                            {application.city}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="sub">
                      {application.job?.title ?? "Lowongan"}
                    </td>
                    <td>
                      <Badge value={application.stage} />
                    </td>
                    <td className="sub text-[13px]">
                      <time
                        dateTime={application.created_at}
                        suppressHydrationWarning
                      >
                        {relativeTime(application.created_at)}
                      </time>
                    </td>
                    <td className="sub">{application.source || "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center sub py-10">
                      {applications.length
                        ? "Tidak ada kandidat yang cocok dengan filter."
                        : "Belum ada pelamar. Bagikan link lowongan untuk mulai menerima lamaran."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <CandidateDetailModal
          application={selected}
          onPatch={patch}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
