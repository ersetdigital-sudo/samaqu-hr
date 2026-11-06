"use client";

import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { StageTag } from "@/components/stage-tag";
import { STAGES, ini } from "@/lib/data";

export function KandidatView() {
  const {
    jobs,
    candidates,
    candQ,
    setCandQ,
    candStage,
    setCandStage,
    openCand,
    toast,
  } = useRecruitment();

  const list = candidates.filter(
    (candidate) =>
      (candStage === "Semua" || candidate.stage === candStage) &&
      (candidate.name + candidate.pos)
        .toLowerCase()
        .includes(candQ.toLowerCase())
  );

  return (
    <>
      <PageHead
        title="Kandidat"
        subtitle="Seluruh pelamar lintas lowongan. Klik baris untuk melihat detail."
      >
        <button
          className="btn btn-g"
          onClick={() => toast("Ekspor belum tersedia")}
        >
          Ekspor
        </button>
      </PageHead>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full md:w-80">
          <input
            id="cq"
            className="inp inp-search"
            placeholder="Cari nama atau posisi…"
            value={candQ}
            onChange={(event) => setCandQ(event.target.value)}
          />
          <Icon
            name="search"
            className="search-icon"
          />
        </div>
        <select
          className="inp !w-auto"
          value={candStage}
          onChange={(event) => setCandStage(event.target.value)}
        >
          {["Semua", ...STAGES].map((stage) => (
            <option key={stage}>{stage}</option>
          ))}
        </select>
        <select
          className="inp !w-auto"
          onChange={() => toast("Filter posisi belum tersedia")}
        >
          <option>Semua posisi</option>
          {jobs.map((job) => (
            <option key={job.id}>{job.pos}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Kandidat</th>
              <th>Posisi</th>
              <th>Tahap</th>
              <th>Skor Screening</th>
              <th>Sumber</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {list.map((candidate) => (
              <tr
                key={candidate.id}
                className="cursor-pointer"
                onClick={() => openCand(candidate.id)}
              >
                <td>
                  <div className="flex items-center gap-3">
                    <div className="av">{ini(candidate.name)}</div>
                    <b>{candidate.name}</b>
                  </div>
                </td>
                <td className="sub">{candidate.pos}</td>
                <td>
                  <StageTag stage={candidate.stage} />
                </td>
                <td>
                  {candidate.score ? (
                    <>
                      <b>{candidate.score}</b>
                      <span className="sub">/100</span>
                    </>
                  ) : (
                    <span className="sub">—</span>
                  )}
                </td>
                <td className="sub">{candidate.src}</td>
                <td className="sub text-[13px]">{candidate.note}</td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center sub py-10">
                  Tidak ada kandidat yang cocok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
