import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { formatDateID, isoDateJakarta } from "@/lib/datetime";
import { recruitmentFailure } from "@/lib/recruitment/live/http";
import {
  listReportApplications,
  loadRecruitmentReport,
  normalizeJobFilter,
} from "@/lib/recruitment/live/reports";
import {
  acceptanceRate,
  formatPercent,
  isReportPeriod,
  sourceLabel,
} from "@/lib/recruitment/reports/model";

export const dynamic = "force-dynamic";

/** Cegah formula injection: sel yang diawali =, +, -, @ diberi awalan aman. */
const sanitizeFormula = (value: string) =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;

const csvText = (value: string) =>
  `"${sanitizeFormula(value).replace(/"/g, '""')}"`;

export async function GET(request: Request) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period = isReportPeriod(periodParam) ? periodParam : "30";
    const jobId = normalizeJobFilter(url.searchParams.get("job"));
    const dataset =
      url.searchParams.get("dataset") === "applicants"
        ? "applicants"
        : "jobs";
    const stamp = isoDateJakarta();

    let csv: string;
    let filename: string;

    if (dataset === "applicants") {
      const rows = await listReportApplications(period, jobId);
      const header = [
        "Nomor Lamaran",
        "Lowongan",
        "Tahap",
        "Sumber",
        "Tanggal Melamar",
        "Tanggal Diterima/Ditolak",
      ];
      const lines = rows.map((row) =>
        [
          csvText(row.applicationNumber),
          csvText(row.jobTitle),
          csvText(row.stage),
          csvText(sourceLabel(row.source)),
          csvText(formatDateID(row.appliedAt)),
          csvText(row.finalAt ? formatDateID(row.finalAt) : ""),
        ].join(",")
      );
      csv = [header.map(csvText).join(","), ...lines].join("\r\n");
      filename = `laporan-pelamar-${stamp}.csv`;
    } else {
      const report = await loadRecruitmentReport(period, jobId);
      const header = [
        "Lowongan",
        "Total Pelamar",
        "Sedang Diproses",
        "Diterima",
        "Ditolak",
        "Persen Diterima",
      ];
      const lines = report.perJob.map((row) =>
        [
          csvText(row.title),
          String(row.total),
          String(row.inProgress),
          String(row.accepted),
          String(row.rejected),
          csvText(formatPercent(acceptanceRate(row.accepted, row.total), 1)),
        ].join(",")
      );
      csv = [header.map(csvText).join(","), ...lines].join("\r\n");
      filename = `laporan-lowongan-${stamp}.csv`;
    }

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return recruitmentFailure(error);
  }
}
