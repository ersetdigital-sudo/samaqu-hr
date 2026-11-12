/** Helper route API Mutasi & Promosi. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { isoDateJakarta } from "@/lib/datetime";
import { PositionHistoryDataError } from "@/lib/position-history/repository";
import {
  isPositionChangeType,
  normalizeManagerId,
  validatePositionChange,
} from "@/lib/position-history/rules";
import type { PositionChangeInput } from "@/lib/position-history/types";

export const positionHistoryGuard = () => requireApiRole(["hr_manager"]);

export function positionHistoryFailure(error: unknown) {
  if (error instanceof PositionHistoryDataError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error("[position-history] gagal memproses permintaan", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data riwayat jabatan" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new PositionHistoryDataError("Asal permintaan tidak valid", 403);
  }
}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export async function readPositionChangePayload(
  request: Request
): Promise<PositionChangeInput> {
  if (Number(request.headers.get("content-length")) > 20_000) {
    throw new PositionHistoryDataError("Data terlalu besar", 413);
  }

  const raw = await request.text();
  if (raw.length > 20_000) {
    throw new PositionHistoryDataError("Data terlalu besar", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new PositionHistoryDataError("Data perubahan tidak valid");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PositionHistoryDataError("Data perubahan tidak valid");
  }

  const record = value as Record<string, unknown>;
  if (!isPositionChangeType(record.changeType)) {
    throw new PositionHistoryDataError("Pilih jenis perubahan", 400, {
      changeType: "Pilih jenis perubahan",
    });
  }

  const input: PositionChangeInput = {
    employeeId: text(record.employeeId),
    changeType: record.changeType,
    effectiveDate: text(record.effectiveDate),
    reason: text(record.reason),
    oldPosition: text(record.oldPosition),
    oldDepartment: text(record.oldDepartment),
    oldManagerId: normalizeManagerId(record.oldManagerId),
    oldLocation: text(record.oldLocation),
    newPosition: text(record.newPosition),
    newDepartment: text(record.newDepartment),
    newManagerId: normalizeManagerId(record.newManagerId),
    newLocation: text(record.newLocation),
  };

  const errors = validatePositionChange(input, {
    todayIso: isoDateJakarta(),
  });
  if (Object.keys(errors).length > 0) {
    throw new PositionHistoryDataError(
      errors.form ?? "Periksa kembali isian perubahan",
      400,
      errors
    );
  }

  return input;
}

