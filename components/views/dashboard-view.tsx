"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ActivityCard } from "@/components/overview/activity-card";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { HRIS_SUMMARY } from "@/lib/hris/summary";
import {
  ALL_MODULES,
  canAccess,
  type NavModule,
} from "@/lib/navigation";
import {
  countInterviewsToday,
  latestActivities,
  upcomingInterviews,
} from "@/lib/recruitment/selectors";
import type { SessionUser } from "@/lib/session";

const ACTIVE_JOB_STATUS = "Aktif";

function SummaryCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link href={href} className="card p-5 transition hover:-translate-y-0.5">
      <div className="text-[12px] sub font-semibold">{label}</div>
      <div className="text-[26px] font-bold tracking-tight mt-2">{value}</div>
      <div className="text-[12px] sub mt-1">{hint}</div>
    </Link>
  );
}

function ModuleCard({ module }: { module: NavModule }) {
  const live = module.status === "live";
  return (
    <Link
      href={module.href}
      className="card p-5 flex flex-col gap-3 transition hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-9 h-9 rounded-lg grid place-items-center"
          style={{ background: "#F2F0EF" }}
        >
          <Icon name={module.icon} style={{ width: 17 }} />
        </div>
        <span className={`tag ${live ? "t-ok" : "t-mute"}`}>
          {live ? "Tersedia" : "Segera"}
        </span>
      </div>
      <div>
        <div className="font-bold text-[14px]">{module.label}</div>
        <div className="text-[12px] sub mt-1 leading-snug">
          {module.description}
        </div>
      </div>
    </Link>
  );
}

export function DashboardView({ user }: { user: SessionUser }) {
  const { jobs, candidates, interviews, activities } = useRecruitment();

  const activeJobs = jobs.filter((job) => job.st === ACTIVE_JOB_STATUS).length;
  const todayInterviews = useMemo(
    () => countInterviewsToday(interviews),
    [interviews]
  );
  const pipelineNow = useMemo(
    () => upcomingInterviews(interviews, new Date()).length,
    [interviews]
  );
  const latest = useMemo(
    () => latestActivities(activities).slice(0, 4),
    [activities]
  );

  const modules = ALL_MODULES.filter(
    (module) =>
      module.id !== "dashboard" && canAccess(user.role, module)
  );

  return (
    <>
      <PageHead
        title={`Selamat pagi, ${user.name}`}
        subtitle="Ringkasan HRIS lintas modul. Angka recruitment diambil dari data terbaru, modul lain masih data contoh."
      >
        <Link className="btn btn-g" href="/recruitment/overview">
          Buka Recruitment
        </Link>
        <Link className="btn btn-p" href="/knowledge-hub/beranda">
          Knowledge Hub
        </Link>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Karyawan Aktif"
          value={String(HRIS_SUMMARY.employees.total)}
          hint={`+${HRIS_SUMMARY.employees.newThisMonth} bulan ini`}
          href="/employees"
        />
        <SummaryCard
          label="Kehadiran Hari Ini"
          value={`${HRIS_SUMMARY.attendance.presentToday}%`}
          hint={`${HRIS_SUMMARY.attendance.late} terlambat`}
          href="/attendance"
        />
        <SummaryCard
          label="Lowongan Aktif"
          value={String(activeJobs)}
          hint="Modul Recruitment"
          href="/recruitment/lowongan"
        />
        <SummaryCard
          label="Kandidat di Pipeline"
          value={String(candidates.length)}
          hint={`${todayInterviews} wawancara hari ini`}
          href="/recruitment/pipeline"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-[17px]">Modul HRIS</div>
            <span className="text-[12px] sub">
              {modules.filter((module) => module.status === "live").length} dari{" "}
              {modules.length} modul siap
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 min-w-0 flex flex-col gap-6">
          <ActivityCard activities={latest} />

          <div className="card p-6">
            <div className="font-bold mb-1">Perlu perhatian</div>
            <div className="text-[13px] sub mb-4">
              Titik yang menunggu tindakan HR
            </div>
            <div className="flex flex-col gap-3 text-[13px]">
              <Link
                href="/payroll"
                className="flex items-center justify-between gap-3"
              >
                <span>Payroll {HRIS_SUMMARY.payroll.period}</span>
                <span className="tag t-warn">
                  {HRIS_SUMMARY.payroll.progress}% siap
                </span>
              </Link>
              <Link
                href="/learning"
                className="flex items-center justify-between gap-3"
              >
                <span>Training wajib belum selesai</span>
                <span className="tag t-info">
                  {HRIS_SUMMARY.learning.mandatoryPending} materi
                </span>
              </Link>
              <Link
                href="/recruitment/jadwal"
                className="flex items-center justify-between gap-3"
              >
                <span>Wawancara mendatang</span>
                <span className="tag t-ok">{pipelineNow} jadwal</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
