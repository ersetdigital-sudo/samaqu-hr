import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { ActivityCard } from "@/components/overview/activity-card";
import { ACADEMY_URL } from "@/lib/external-links";
import {
  ALL_MODULES,
  canAccess,
  isModuleLive,
  type NavModule,
} from "@/lib/navigation";
import type { SessionUser } from "@/lib/session";
import type {
  EmployeeDashboardStats,
  RecruitmentDashboard,
} from "@/lib/dashboard/repository";
import { ModuleCard } from "./module-card";
import { SummaryCard } from "./summary-card";

export function StaffDashboard({
  user,
  recruitment,
  employees,
  showEmployees,
  error,
}: {
  user: SessionUser;
  recruitment: RecruitmentDashboard | null;
  employees: EmployeeDashboardStats | null;
  showEmployees: boolean;
  error?: string;
}) {
  const modules = ALL_MODULES.filter(
    (module: NavModule) =>
      module.id !== "dashboard" &&
      !module.external &&
      canAccess(user.role, module)
  );
  const externalModules = ALL_MODULES.filter(
    (module) => module.external && canAccess(user.role, module)
  );
  const employeeStats = showEmployees ? employees : null;
  const showStats = Boolean(recruitment || employeeStats);

  return (
    <>
      <PageHead
        title={`Halo, ${user.name}`}
        subtitle={
          showEmployees
            ? "Ringkasan rekrutmen dan data karyawan dari data terbaru. Modul Kehadiran, Payroll, dan Performance belum tersedia."
            : "Ringkasan rekrutmen dari data terbaru."
        }
      >
        <Link
          prefetch={false}
          className="btn btn-g"
          href="/recruitment/overview"
        >
          Buka Recruitment
        </Link>
        <a
          className="btn btn-p"
          href={ACADEMY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Samaqu Academy
          <Icon name="external" style={{ width: 14 }} />
        </a>
      </PageHead>

      {error && (
        <div className="card p-6 mb-6">
          <div className="font-bold mb-1">Data dashboard belum dapat dimuat</div>
          <p className="sub text-[13px] mb-4">{error}</p>
          <Link prefetch={false} className="btn btn-g" href="/">
            Muat ulang
          </Link>
        </div>
      )}

      {showStats && (
        <div
          className={`grid grid-cols-2 gap-4 mb-8 ${
            employeeStats
              ? "md:grid-cols-3 xl:grid-cols-5"
              : "md:grid-cols-3"
          }`}
        >
          {employeeStats && (
            <>
              <SummaryCard
                label="Karyawan Aktif"
                value={String(employeeStats.active)}
                hint={
                  employeeStats.joinedThisMonth > 0
                    ? `+${employeeStats.joinedThisMonth} bergabung bulan ini`
                    : "Belum ada karyawan baru bulan ini"
                }
                href="/employees/direktori"
              />
              <SummaryCard
                label="Kehadiran Hari Ini"
                value="Segera"
                hint="Modul Attendance & Leave belum tersedia"
                href="/attendance"
              />
            </>
          )}
          {recruitment && (
            <>
              <SummaryCard
                label="Lowongan Aktif"
                value={String(recruitment.activeJobs)}
                hint={recruitment.jobHint || "Belum ada lowongan aktif"}
                href="/recruitment/lowongan"
              />
              <SummaryCard
                label="Kandidat di Pipeline"
                value={String(recruitment.totalCandidates)}
                hint={
                  recruitment.newLast7Days > 0
                    ? `+${recruitment.newLast7Days} baru minggu ini`
                    : "Belum ada pelamar baru"
                }
                href="/recruitment/pipeline"
              />
              <SummaryCard
                label="Wawancara Terdekat"
                value={String(recruitment.upcomingInterviews)}
                hint={
                  recruitment.todayInterviews > 0
                    ? `${recruitment.todayInterviews} hari ini`
                    : "Tidak ada jadwal hari ini"
                }
                href="/recruitment/jadwal"
              />
            </>
          )}
        </div>
      )}

      <div
        className={`grid gap-6 ${
          recruitment ? "lg:grid-cols-5" : ""
        }`}
      >
        <div className={`${recruitment ? "lg:col-span-3" : ""} min-w-0`}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-[17px]">Modul HRIS</div>
            <span className="text-[12px] sub">
              {modules.filter((module) => isModuleLive(module)).length} dari{" "}
              {modules.length} modul siap
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
          {externalModules.length > 0 && (
            <>
              <div className="text-[12px] sub font-semibold mt-6 mb-2">
                Layanan eksternal
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {externalModules.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
            </>
          )}
        </div>

        {recruitment && (
          <div className="lg:col-span-2 min-w-0 flex flex-col gap-6">
            <ActivityCard activities={recruitment.activities} />

            <div className="card p-6">
              <div className="font-bold mb-1">Perlu perhatian</div>
              <div className="text-[13px] sub mb-4">
                Titik yang menunggu tindakan HR
              </div>
              <div className="flex flex-col gap-3 text-[13px]">
                <Link
                  prefetch={false}
                  href="/recruitment/pipeline"
                  className="flex items-center justify-between gap-3"
                >
                  <span>Menunggu screening</span>
                  <span
                    className={`tag ${
                      recruitment.pendingScreening > 0 ? "t-warn" : "t-mute"
                    }`}
                  >
                    {recruitment.pendingScreening} pelamar
                  </span>
                </Link>
                <Link
                  prefetch={false}
                  href="/recruitment/jadwal"
                  className="flex items-center justify-between gap-3"
                >
                  <span>Wawancara mendatang</span>
                  <span className="tag t-ok">
                    {recruitment.upcomingInterviews} jadwal
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
