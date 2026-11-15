/** Pengiriman file XLSX laporan + pencatatan audit sebelum kirim. */

import "server-only";
import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  logReportExport,
  ReportDataError,
} from "@/lib/reports/repository";
import { MAX_EXPORT_ROWS, REPORT_TYPE_LABELS } from "@/lib/reports/rules";
import type { BuiltWorkbook } from "@/lib/reports/xlsx";
import type { ReportAccessType } from "@/lib/reports/types";

export function reportFilename(prefix: string): string {
  return `${prefix}-${isoDateJakarta()}.xlsx`;
}

export async function sendReportWorkbook({
  workbook,
  filename,
  reportType,
  reportLabel,
  filterSummary,
}: {
  workbook: BuiltWorkbook;
  filename: string;
  reportType: ReportAccessType;
  reportLabel?: string;
  filterSummary: string;
}) {
  if (workbook.rowCount > MAX_EXPORT_ROWS) {
    throw new ReportDataError(
      `Ekspor maksimal ${MAX_EXPORT_ROWS.toLocaleString("id-ID")} baris.`,
      400
    );
  }

  // Wajib tercatat sebelum file dikirim; kegagalan log membatalkan ekspor.
  await logReportExport({
    reportType,
    reportLabel: reportLabel ?? REPORT_TYPE_LABELS[reportType],
    filterSummary,
    rowCount: workbook.rowCount,
  });

  return new NextResponse(new Uint8Array(workbook.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
