"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/icons";
import { ActivityCard } from "@/components/overview/activity-card";
import { OverviewErrorState } from "@/components/overview/overview-states";
import { PipelineCard } from "@/components/overview/pipeline-card";
import { StatCards } from "@/components/overview/stat-cards";
import { TopJobsCard } from "@/components/overview/top-jobs-card";
import { UpcomingInterviews } from "@/components/overview/upcoming-interviews";
import { PageHead } from "@/components/page-head";
import type { RecruitmentOverview } from "@/lib/recruitment/live/overview";
import type { Interview } from "@/lib/recruitment/types";

export function OverviewView({
  userName,
  initial,
  initialError,
  interviews,
}: {
  userName: string;
  initial: RecruitmentOverview | null;
  initialError?: string;
  interviews: Interview[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  if (!initial)
    return (
      <>
        <PageHead
          title={`Halo, ${userName}`}
          subtitle="Ringkasan rekrutmen dari data pelamar terbaru."
        />
        <OverviewErrorState
          message={
            initialError ??
            "Data rekrutmen belum dapat dimuat. Silakan coba lagi."
          }
        />
      </>
    );

  return (
    <>
      <PageHead
        title={`Halo, ${userName}`}
        subtitle={`${initial.pendingScreening} lamaran menunggu screening dan ${initial.newLast7Days} pelamar baru dalam 7 hari terakhir.`}
      >
        <button className="btn btn-g" onClick={refresh} disabled={pending}>
          {pending ? "Memuat…" : "Muat ulang"}
        </button>
        <Link
          prefetch={false}
          href="/recruitment/lowongan/baru"
          className="btn btn-p"
        >
          <Icon name="plus" style={{ width: 16 }} />
          Buat Lowongan
        </Link>
      </PageHead>

      <StatCards stats={initial.stats} />
      <PipelineCard metrics={initial.pipeline} />
      <div className="grid lg:grid-cols-5 gap-6">
        <ActivityCard title="Pelamar Terbaru" activities={initial.activities} />
        <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
          <UpcomingInterviews interviews={interviews} />
          <TopJobsCard jobs={initial.topJobs} />
        </div>
      </div>
    </>
  );
}
