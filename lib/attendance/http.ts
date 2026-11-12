/** Helper route API Attendance. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { isValidIsoDate, isValidMonthKey } from "@/lib/attendance/rules";
import { AttendanceDataError } from "@/lib/attendance/repository";

/** Halaman/API karyawan: hanya role employee. */
export const attendanceSelfGuard = () => requireApiRole(["employee"]);

/** Halaman/API HR: hanya HR Manager/Admin. */
export const attendanceStaffGuard = () => requireApiRole(["hr_manager"]);

export function attendanceFailure(error: unknown) {
  if (error instanceof AttendanceDataError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error("[attendance] gagal memproses permintaan", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data kehadiran" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AttendanceDataError("Asal permintaan tidak valid", 403);
  }
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 20_000) {
    throw new AttendanceDataError("Data terlalu besar", 413);
  }

  const raw = await request.text();
  if (raw.length > 20_000) {
    throw new AttendanceDataError("Data terlalu besar", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AttendanceDataError("Data tidak valid");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AttendanceDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}

export const textValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export function integerValue(value: unknown, fallback = NaN): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }
  return fallback;
}

export function monthParam(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!isValidMonthKey(value)) {
    throw new AttendanceDataError("Bulan tidak valid", 400);
  }
  return value;
}

export function dateParam(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!isValidIsoDate(value)) {
    throw new AttendanceDataError("Tanggal tidak valid", 400);
  }
  return value;
}

export function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new AttendanceDataError("Data tidak ditemukan", 404);
  }
}
