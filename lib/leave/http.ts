/** Helper route API Cuti & Izin: guard, same-origin, form, dan lampiran. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { isValidMonthKey } from "@/lib/attendance/rules";
import { LeaveDataError } from "@/lib/leave/repository";
import {
  LEAVE_ATTACHMENT_MAX_BYTES,
  LEAVE_ATTACHMENT_SIZE_ERROR,
  validateLeaveAttachmentBytes,
  validateLeaveAttachmentMeta,
  type LeaveAttachmentMime,
} from "@/lib/leave/validation";

export const leaveSelfGuard = () => requireApiRole(["employee"]);
export const leaveStaffGuard = () => requireApiRole(["hr_manager"]);
export const leaveReadGuard = () =>
  requireApiRole(["hr_manager", "employee"]);

export function leaveFailure(error: unknown, context: string) {
  if (error instanceof LeaveDataError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error(`[leave] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data cuti" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new LeaveDataError("Asal permintaan tidak valid", 403);
  }
}

export function assertUuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new LeaveDataError("Pengajuan tidak ditemukan", 404);
  }
}

export function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function yearParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new LeaveDataError("Tahun tidak valid", 400);
  }
  return year;
}

export function monthParam(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!isValidMonthKey(value)) {
    throw new LeaveDataError("Bulan tidak valid", 400);
  }
  return value;
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 20_000) {
    throw new LeaveDataError("Data terlalu besar", 413);
  }

  const raw = await request.text();
  if (raw.length > 20_000) {
    throw new LeaveDataError("Data terlalu besar", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new LeaveDataError("Data tidak valid");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeaveDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}

/** Batasi body multipart sebelum di-parse. */
export async function readLeaveForm(request: Request): Promise<FormData> {
  const limit = LEAVE_ATTACHMENT_MAX_BYTES + 131_072;
  if (Number(request.headers.get("content-length")) > limit) {
    throw new LeaveDataError(LEAVE_ATTACHMENT_SIZE_ERROR, 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new LeaveDataError("Form pengajuan kosong");

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.length;
    if (bytes > limit) {
      await reader.cancel();
      throw new LeaveDataError(LEAVE_ATTACHMENT_SIZE_ERROR, 413);
    }
    chunks.push(chunk.value);
  }

  const body = Buffer.concat(chunks);
  try {
    return await new Response(body, {
      headers: {
        "Content-Type": request.headers.get("content-type") || "",
      },
    }).formData();
  } catch {
    throw new LeaveDataError("Data unggahan tidak valid");
  }
}

export async function readLeaveAttachment(
  form: FormData,
  required: boolean
): Promise<{ file: File; mimeType: LeaveAttachmentMime } | null> {
  const value = form.get("attachment");
  if (!(value instanceof File) || value.size === 0) {
    if (!required) return null;
    throw new LeaveDataError("Lampiran wajib dipilih", 400, {
      attachment: "Lampiran wajib dipilih",
    });
  }

  const metaError = validateLeaveAttachmentMeta(value);
  if (metaError) {
    throw new LeaveDataError(metaError, 400, { attachment: metaError });
  }

  const head = new Uint8Array(await value.slice(0, 8).arrayBuffer());
  const checked = validateLeaveAttachmentBytes(head, value.name, value.type);
  if (!checked.ok) {
    throw new LeaveDataError(checked.error, 400, {
      attachment: checked.error,
    });
  }

  return { file: value, mimeType: checked.mimeType };
}
