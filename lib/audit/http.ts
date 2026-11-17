/** Helper route audit. */

import "server-only";
import { NextResponse } from "next/server";
import { AuditDataError } from "@/lib/audit/repository";

export function auditFailure(error: unknown, context: string) {
  if (error instanceof AuditDataError) {
    if (error.status >= 500) {
      console.error(`[audit] ${context}`, {
        code: error.technical?.code,
        function: error.technical?.functionName,
        message: error.technical?.message ?? error.message,
      });
    }
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[audit] ${context}`, {
    message: error instanceof Error ? error.message : "Kesalahan tidak diketahui",
  });
  return NextResponse.json(
    { error: "Terjadi kesalahan pada audit log" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function dateParam(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function textParam(value: string | null): string {
  return value?.trim() ?? "";
}
