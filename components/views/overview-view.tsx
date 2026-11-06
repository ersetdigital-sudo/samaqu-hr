"use client";

import { useMemo } from "react";
import { ActivityCard } from "@/components/overview/activity-card";
import {
  OverviewErrorState,
  OverviewSkeleton,
} from "@/components/overview/overview-states";
import { PipelineCard } from "@/components/overview/pipeline-card";
import { StatCards } from "@/components/overview/stat-cards";
import { UpcomingInterviews } from "@/components/overview/upcoming-interviews";
import { NewJobButton } from "@/components/new-job-button";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  buildPipelineMetrics,
  buildStatCards,
  countInterviewsToday,
  latestActivities,
  upcomingInterviews,
} from "@/lib/recruitment/selectors";

export function OverviewView() {
  const { jobs, candidates, interviews, activities, loading, error, refresh } =
    useRecruitment();

  const stats = useMemo(
    () => buildStatCards(candidates, interviews, jobs),
    [candidates, interviews, jobs]
  );
  const pipeline = useMemo(
    () => buildPipelineMetrics(candidates),
    [candidates]
  );
  const latest = useMemo(() => latestActivities(activities).slice(0, 5), [
    activities,
  ]);
  const nextInterviews = useMemo(
    () => upcomingInterviews(interviews, new Date(), 4),
    [interviews]
  );

  const pendingScreening =
    stats.find((stat) => stat.label === "Menunggu Screening")?.value ?? 0;
  const todayInterviews = useMemo(
    () => countInterviewsToday(interviews),
    [interviews]
  );

  return (
    <>
      <PageHead
        title="Selamat pagi, Ardo"
        subtitle={`Ada ${pendingScreening} lamaran yang menunggu screening dan ${todayInterviews} wawancara hari ini.`}
      >
        <button
          className="btn btn-g"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
        <NewJobButton />
      </PageHead>

      {loading ? (
        <OverviewSkeleton />
      ) : error ? (
        <OverviewErrorState />
      ) : (
        <>
          <StatCards stats={stats} />
          <PipelineCard metrics={pipeline} />
          <div className="grid lg:grid-cols-5 gap-6">
            <ActivityCard activities={latest} />
            <UpcomingInterviews interviews={nextInterviews} />
          </div>
        </>
      )}
    </>
  );
}
