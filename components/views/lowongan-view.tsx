"use client";

import { useRouter } from "next/navigation";
import { NewJobButton } from "@/components/new-job-button";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { StageTag } from "@/components/stage-tag";

const FILTERS = ["Semua", "Aktif", "Draf", "Ditutup"];

export function LowonganView() {
  const router = useRouter();
  const {
    jobs,
    jobF,
    setJobF,
    setPipeFilter,
    openJobModal,
    askClose,
  } = useRecruitment();

  return (
    <>
      <PageHead
        title="Manajemen Lowongan"
        subtitle="Kelola posisi yang dibuka, status publikasi, dan tenggat lamaran."
      >
        <NewJobButton />
      </PageHead>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex bg-[#F1EDEB] p-1 rounded-xl">
          {FILTERS.map((filter) => (
            <div
              key={filter}
              className={`tab ${jobF === filter ? "on" : ""}`}
              onClick={() => setJobF(filter)}
            >
              {`${filter} `}
              <span className="sub font-medium">
                {filter === "Semua"
                  ? jobs.length
                  : jobs.filter((job) => job.st === filter).length}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Posisi</th>
              <th>Status</th>
              <th>Kandidat</th>
              <th>Publikasi</th>
              <th>Tenggat</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {jobs
              .filter((job) => jobF === "Semua" || job.st === jobF)
              .map((job) => (
                <tr key={job.id}>
                  <td>
                    <div className="font-semibold">{job.pos}</div>
                    <div className="text-[12px] sub">{job.dep}</div>
                  </td>
                  <td>
                    <StageTag stage={job.st} />
                  </td>
                  <td>
                    <b>{job.n}</b>{" "}
                    <span className="sub text-[12px]">pelamar</span>
                  </td>
                  <td className="sub">{job.pub}</td>
                  <td className="sub">{job.dl}</td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      className="btn btn-g !px-3 !py-1.5"
                      onClick={() => {
                        setPipeFilter(job.pos);
                        router.push("/recruitment/pipeline");
                      }}
                    >
                      Detail
                    </button>{" "}
                    <button
                      className="btn btn-g !px-3 !py-1.5"
                      onClick={openJobModal}
                    >
                      Edit
                    </button>{" "}
                    {job.st === "Aktif" ? (
                      <button
                        className="btn btn-d !px-3 !py-1.5"
                        onClick={() => askClose(job.id)}
                      >
                        Tutup
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
