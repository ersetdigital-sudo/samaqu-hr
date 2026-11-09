"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { CandidateDetailModal } from "@/components/recruitment-live/candidate-detail";
import {
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

export function PipelineView({
  initial,
  initialError,
  canConvert,
}: {
  initial: RecruitmentBoard | null;
  initialError?: string;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(
    initial?.applications ?? [],
  );
  const [jobFilter, setJobFilter] = useState("Semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setApplications(initial?.applications ?? []);
  }, [initial]);

  const jobs = initial?.jobs ?? [];
  const visible = useMemo(
    () =>
      applications.filter(
        (application) =>
          jobFilter === "Semua" || application.job_id === jobFilter,
      ),
    [applications, jobFilter],
  );
  const selected = applications.find((item) => item.id === selectedId) ?? null;

  function patch(id: string, changes: Partial<JobApplication>) {
    setApplications((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  return (
    <div className="rl">
      <PageHead
        title="Pipeline Kandidat"
        subtitle="Pantau progres kandidat per tahap seleksi. Klik kartu untuk detail."
      >
        <Link
          prefetch={false}
          href="/recruitment/lowongan/baru"
          className="btn btn-p"
        >
          <Icon name="plus" style={{ width: 16 }} />
          Buat Lowongan
        </Link>
      </PageHead>

      {!initial ? (
        <ErrorBox
          message={
            initialError ??
            "Pipeline kandidat belum dapat dimuat. Silakan coba lagi."
          }
          retry={() => router.refresh()}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="inp !w-auto"
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
            >
              <option value="Semua">Semua</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
            <span className="sub text-[13px]">
              {`${visible.length} pelamar ditampilkan`}
              {initial.applications.length < initial.total
                ? ` dari total ${initial.total}`
                : ""}
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const list = visible.filter(
                (application) => application.stage === stage,
              );
              return (
                <div className="kcol" key={stage}>
                  <div className="flex items-center justify-between px-1 pb-3 pt-1">
                    <span className="font-bold text-[13px]">{stage}</span>
                    <span className="tag t-mute">{list.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {list.length > 0 ? (
                      list.map((application) => (
                        <div
                          className="kc cursor-pointer"
                          key={application.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Lihat detail ${application.full_name}`}
                          onClick={() => setSelectedId(application.id)}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();
                              setSelectedId(application.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="av"
                              style={{ width: 28, height: 28, fontSize: 11 }}
                            >
                              {initials(application.full_name)}
                            </div>
                            <div className="font-semibold text-[13px] leading-tight">
                              {application.full_name}
                            </div>
                          </div>
                          <div className="text-[12px] sub mb-3">
                            {application.job?.title ?? "Lowongan"}
                          </div>
                          <div className="flex justify-between items-center text-[12px]">
                            <span className="sub flex items-center gap-1">
                              <Icon name="clock" style={{ width: 13 }} />
                              <time
                                dateTime={application.created_at}
                                suppressHydrationWarning
                              >
                                {relativeTime(application.created_at)}
                              </time>
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        className="text-[12px] sub text-center py-6 border border-dashed rounded-xl"
                        style={{ borderColor: "#DDD5D1" }}
                      >
                        Kosong
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selected && (
        <CandidateDetailModal
          application={selected}
          canConvert={canConvert}
          onPatch={patch}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
