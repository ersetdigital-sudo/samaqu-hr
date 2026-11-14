/** Helper route API Performance Management. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole, requireApiUser } from "@/lib/auth/guard";
import { PerformanceDataError } from "@/lib/performance/repository";

export const performanceStaffGuard = () => requireApiRole(["hr_manager"]);
export const performanceUserGuard = () => requireApiUser();

function technicalDetails(error: unknown) {
  if (error instanceof PerformanceDataError) {
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

export function performanceFailure(error: unknown, context: string) {
  if (error instanceof PerformanceDataError) {
    if (error.status >= 500) {
      console.error(`[performance] ${context}`, technicalDetails(error));
    }
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[performance] ${context}`, technicalDetails(error));
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data penilaian" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new PerformanceDataError("Asal permintaan tidak valid", 403);
  }
}

export function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new PerformanceDataError("Data penilaian tidak ditemukan", 404);
  }
}

export function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 60_000) {
    throw new PerformanceDataError("Data terlalu besar", 413);
  }
  const raw = await request.text();
  if (raw.length > 60_000) {
    throw new PerformanceDataError("Data terlalu besar", 413);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new PerformanceDataError("Data tidak valid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PerformanceDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}
