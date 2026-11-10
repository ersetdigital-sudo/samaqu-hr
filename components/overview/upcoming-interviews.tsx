import Link from "next/link";
import { EmptyState } from "@/components/overview/empty-state";
import { StageTag } from "@/components/stage-tag";
import type { Interview } from "@/lib/recruitment/types";

/** Jadwal wawancara terdekat, sudah terurut dari yang paling dekat. */
export function UpcomingInterviews({
  interviews,
}: {
  interviews: Interview[];
}) {
  return (
    <div className="card lg:col-span-2 min-w-0">
      <div className="px-6 pt-5 pb-3 flex justify-between items-center">
        <span className="font-bold text-[16px]">Wawancara Terdekat</span>
        <Link
          prefetch={false}
          className="text-[13px] font-semibold cursor-pointer"
          style={{ color: "var(--pink)" }}
          href="/recruitment/jadwal"
        >
          Lihat semua
        </Link>
      </div>
      {interviews.length === 0 ? (
        <EmptyState>
          Belum ada wawancara terjadwal. Jadwalkan wawancara dari detail
          pelamar.
        </EmptyState>
      ) : (
        interviews.map((interview) => (
          <div
            className="flex gap-4 px-6 py-3 border-t items-center"
            key={interview.id}
            style={{ borderColor: "var(--line)" }}
          >
            <div className="text-center w-12 shrink-0">
              <div className="text-[11px] sub font-semibold">{interview.d}</div>
              <div className="font-bold">{interview.t}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] truncate">
                {interview.c}
              </div>
              <div className="text-[12px] sub truncate">
                {`${interview.p} · ${interview.m}`}
              </div>
            </div>
            <StageTag stage={interview.st} />
          </div>
        ))
      )}
    </div>
  );
}
