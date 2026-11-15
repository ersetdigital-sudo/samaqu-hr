/** Helper route API Laporan. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { ReportDataError } from "@/lib/reports/repository";

export const reportStaffGuard = () => requireApiRole(["hr_manager"]);
export const reportRecruitmentGuard = () =>
  requireApiRole(["hr_manager", "recruiter"]);

function technicalDetails(error: unknown) {
  if (error instanceof ReportDataError) {
    if (error.technical) {
      return {
        code: error.technical.code,
        function: error.technical.functionName,
        message: error.technical.message,
      };
    }
    return { message: error.message };
  }
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; message?: unknown };
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      message:
        typeof candidate.message === "string"
          ? candidate.message
          : "Kesalahan tidak diketahui",
    };
  }
  return { message: "Kesalahan tidak diketahui" };
}

export function reportFailure(error: unknown, context: string) {
  if (error instanceof ReportDataError) {
    if (error.status >= 500) {
      console.error(`[reports] ${context}`, technicalDetails(error));
    }
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[reports] ${context}`, technicalDetails(error));
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data laporan" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function dateParam(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export function monthParam(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

export function textParam(value: string | null, fallback = ""): string {
  return value?.trim() || fallback;
}
