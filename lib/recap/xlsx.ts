/** Pembuat XLSX rekap kehadiran; hanya dipakai route server. */

import ExcelJS from "exceljs";
import {
  buildRecapExportMatrix,
  RECAP_EXPORT_HEADERS,
} from "@/lib/recap/export";
import type { RecapPeriod, RecapRow } from "@/lib/recap/types";

const COLUMN_WIDTHS = [
  26, 14, 20, 24, 12, 16, 16, 16, 16, 11, 9, 16, 15, 18, 17, 15, 9, 9, 9, 9,
  14, 22, 34,
];

export async function buildRecapXlsx(
  rows: RecapRow[],
  period: RecapPeriod
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Rekap Kehadiran", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const matrix = buildRecapExportMatrix(rows, period);
  sheet.addRow(matrix[0]);

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F1A1C" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 34;

  for (const row of matrix.slice(1)) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column, index) => {
    column.width = COLUMN_WIDTHS[index] ?? 16;
  });

  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(21).numFmt = "0.00";
    row.getCell(22).numFmt = "0.0";
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: RECAP_EXPORT_HEADERS.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
