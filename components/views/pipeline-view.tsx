"use client";

import { Icon } from "@/components/icons";
import { NewJobButton } from "@/components/new-job-button";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { STAGES, ini } from "@/lib/data";

export function PipelineView() {
  const {
    jobs,
    candidates,
    pipeFilter,
    setPipeFilter,
    openCand,
  } = useRecruitment();

  const visible = candidates.filter(
    (candidate) => pipeFilter === "Semua" || candidate.pos === pipeFilter
  );

  return (
    <>
      <PageHead
        title="Pipeline Kandidat"
        subtitle="Pantau progres kandidat per tahap seleksi. Klik kartu untuk detail."
      >
        <NewJobButton />
      </PageHead>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          className="inp !w-auto"
          value={pipeFilter}
          onChange={(event) => setPipeFilter(event.target.value)}
        >
          <option>Semua</option>
          {jobs
            .filter((job) => job.n)
            .map((job) => (
              <option key={job.id}>{job.pos}</option>
            ))}
        </select>
        <span className="sub text-[13px]">
          {`${visible.length} kandidat ditampilkan`}
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const list = visible.filter(
            (candidate) => candidate.stage === stage
          );
          return (
            <div className="kcol" key={stage}>
              <div className="flex items-center justify-between px-1 pb-3 pt-1">
                <span className="font-bold text-[13px]">{stage}</span>
                <span className="tag t-mute">{list.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {list.length > 0 ? (
                  list.map((candidate) => (
                    <div
                      className="kc"
                      key={candidate.id}
                      onClick={() => openCand(candidate.id)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="av"
                          style={{ width: 28, height: 28, fontSize: 11 }}
                        >
                          {ini(candidate.name)}
                        </div>
                        <div className="font-semibold text-[13px] leading-tight">
                          {candidate.name}
                        </div>
                      </div>
                      <div className="text-[12px] sub mb-3">
                        {candidate.pos}
                      </div>
                      <div className="flex justify-between items-center text-[12px]">
                        <span className="sub flex items-center gap-1">
                          <Icon name="clock" style={{ width: 13 }} />
                          {candidate.note}
                        </span>
                        {candidate.score ? (
                          <b style={{ color: "var(--pink)" }}>
                            {candidate.score}
                          </b>
                        ) : null}
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
  );
}
