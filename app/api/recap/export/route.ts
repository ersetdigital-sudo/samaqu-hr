import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  exportFilters,
  recapFailure,
  recapMonthParam,
  recapStaffGuard,
} from "@/lib/recap/http";
import { buildRecapCsv } from "@/lib/recap/export";
import { filterRecapRows, sortRecapRows } from "@/lib/recap/rules";
import { getRecapData, RecapDataError } from "@/lib/recap/repository";
import { buildRecapXlsx } from "@/lib/recap/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await recapStaffGuard();
  if (guard.response) return guard.response;

  try {
    const url = new URL(request.url);
    const month = recapMonthParam(
      url.searchParams.get("month"),
      isoDateJakarta().slice(0, 7)
    );
    const format = url.searchParams.get("format") ?? "csv";
    if (format !== "csv" && format !== "xlsx") {
      throw new RecapDataError("Format ekspor tidak valid", 400);
    }

    const data = await getRecapData(month);
    const rows = sortRecapRows(
      filterRecapRows(data.rows, exportFilters(url)),
      { key: "employee", direction: "asc" }
    );

    if (format === "csv") {
      const csv = buildRecapCsv(rows, data.period);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="rekap-kehadiran-${month}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const xlsx = await buildRecapXlsx(rows, data.period);
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap-kehadiran-${month}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return recapFailure(error, "gagal mengekspor rekap");
  }
}
