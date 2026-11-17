/** Helper route API Notifikasi. */

import "server-only";
import { NextResponse } from "next/server";
import { NotificationDataError } from "@/lib/notifications/repository";

function technicalDetails(error: unknown) {
  if (error instanceof NotificationDataError) {
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

export function notificationFailure(error: unknown, context: string) {
  if (error instanceof NotificationDataError) {
    if (error.status >= 500) {
      console.error(`[notifications] ${context}`, technicalDetails(error));
    }
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  console.error(`[notifications] ${context}`, technicalDetails(error));
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data notifikasi" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 20_000) {
    throw new NotificationDataError("Data terlalu besar", 413);
  }
  const raw = await request.text();
  if (raw.length > 20_000) {
    throw new NotificationDataError("Data terlalu besar", 413);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new NotificationDataError("Data tidak valid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NotificationDataError("Data tidak valid");
  }
  return value as Record<string, unknown>;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new NotificationDataError("Asal permintaan tidak valid", 403);
  }
}
