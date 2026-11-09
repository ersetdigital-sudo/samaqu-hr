import Link from "next/link";
import { EmptyState } from "@/components/overview/empty-state";
import type { OverviewTopJob } from "@/lib/recruitment/live/overview";

/** Lowongan dengan pelamar terbanyak dari snapshot data live. */
export function TopJobsCard({ jobs }: { jobs: OverviewTopJob[] }) {
  return (
    <div className="card min-w-0">
      <div className="px-6 pt-5 pb-3 font-bold text-[16px]">
        Lowongan Terbanyak Pelamar
      </div>
      {jobs.length === 0 ? (
        <EmptyState>Belum ada pelamar per lowongan.</EmptyState>
      ) : (
        jobs.map((job, index) => (
          <div
            className="flex items-center gap-3 px-6 py-3 border-t"
            key={job.id}
            style={{ borderColor: "var(--line)" }}
          >
            <span className="text-[12px] sub font-semibold w-4">
              {index + 1}
            </span>
            <Link
              prefetch={false}
              href={`/recruitment/lowongan/${job.id}/pelamar`}
              className="flex-1 min-w-0 text-[13px] font-semibold truncate"
            >
              {job.title}
            </Link>
            <span className="tag t-mute whitespace-nowrap">
              {job.count} pelamar
            </span>
          </div>
        ))
      )}
    </div>
  );
}
