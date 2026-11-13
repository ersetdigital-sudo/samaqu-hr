/** Helper route API Rekap Kehadiran. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { isValidMonthKey } from "@/lib/attendance/rules";
import { RecapDataError } from "@/lib/recap/repository";
import type { RecapFilters } from "@/lib/recap/types";

export const recapStaffGuard = () => requireApiRole(["hr_manager"]);
export const recapSelfGuard = () => requireApiRole(["employee"]);

export function recapFailure(error: unknown, context: string) {
  if (error instanceof RecapDataError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error(`[recap] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data rekap kehadiran" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new RecapDataError("Asal permintaan tidak valid", 403);
  }
}

export function recapMonthParam(
  value: string | null,
  fallback: string
): string {
  if (!value) return fallback;
  if (!isValidMonthKey(value)) {
    throw new RecapDataError("Bulan rekap tidak valid", 400);
  }
  return value;
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 20_000) {
    throw new RecapDataError("Data terlalu besar", 413);
  }

  const raw = await request.text();
  if (raw.length > 20_000) {
    throw new RecapDataError("Data terlalu besar", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new RecapDataError("Data tidak valid");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecapDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}

export function exportFilters(url: URL): RecapFilters {
  return {
    q: (url.searchParams.get("q") ?? "").trim(),
    department: url.searchParams.get("department") ?? "Semua",
    status: url.searchParams.get("status") ?? "Semua",
  };
}
