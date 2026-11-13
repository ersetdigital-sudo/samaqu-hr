/** Helper route API Lembur. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { OvertimeDataError } from "@/lib/overtime/repository";

export const overtimeSelfGuard = () => requireApiRole(["employee"]);
export const overtimeStaffGuard = () => requireApiRole(["hr_manager"]);

export function overtimeFailure(error: unknown, context: string) {
  if (error instanceof OvertimeDataError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[overtime] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data lembur" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new OvertimeDataError("Asal permintaan tidak valid", 403);
  }
}

export function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new OvertimeDataError("Pengajuan lembur tidak ditemukan", 404);
  }
}

export function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function integerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 20_000) {
    throw new OvertimeDataError("Data terlalu besar", 413);
  }

  const raw = await request.text();
  if (raw.length > 20_000) {
    throw new OvertimeDataError("Data terlalu besar", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new OvertimeDataError("Data tidak valid");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OvertimeDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}
