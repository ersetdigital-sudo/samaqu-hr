/** Helper route API Payroll. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { PayrollDataError } from "@/lib/payroll/repository";

export const payrollStaffGuard = () => requireApiRole(["hr_manager"]);
export const payrollSelfGuard = () => requireApiRole(["employee"]);

export function payrollFailure(error: unknown, context: string) {
  if (error instanceof PayrollDataError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[payroll] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data payroll" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new PayrollDataError("Asal permintaan tidak valid", 403);
  }
}

export function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new PayrollDataError("Data payroll tidak ditemukan", 404);
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
    throw new PayrollDataError("Data terlalu besar", 413);
  }
  const raw = await request.text();
  if (raw.length > 60_000) {
    throw new PayrollDataError("Data terlalu besar", 413);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new PayrollDataError("Data tidak valid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PayrollDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}

export function monthFromParam(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new PayrollDataError("Periode tidak valid", 400);
  }
  return `${value}-01`;
}
