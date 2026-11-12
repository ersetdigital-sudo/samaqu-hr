/** Helper route API dokumen: guard, same-origin, form, dan validasi file. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { DocumentDataError } from "@/lib/documents/repository";
import {
  MAX_DOCUMENT_BYTES,
  validateDocumentFileBytes,
  validateDocumentFileMeta,
} from "@/lib/documents/validation";
import type { DocumentMimeType } from "@/lib/documents/types";

export const documentsStaffGuard = () => requireApiRole(["hr_manager"]);

/** Staff penuh atau karyawan (baris sendiri) — RLS menyaring kepemilikan. */
export const documentReadGuard = () =>
  requireApiRole(["hr_manager", "employee"]);

export function documentFailure(error: unknown, context: string) {
  if (error instanceof DocumentDataError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error(`[documents] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data dokumen" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DocumentDataError("Asal permintaan tidak valid", 403);
  }
}

export function assertDocumentId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new DocumentDataError("Dokumen tidak ditemukan", 404);
  }
}

/** Batasi body multipart sebelum di-parse agar tidak menahan file besar. */
export async function readDocumentForm(request: Request): Promise<FormData> {
  const limit = MAX_DOCUMENT_BYTES + 131_072;
  if (Number(request.headers.get("content-length")) > limit) {
    throw new DocumentDataError("Ukuran unggahan maksimal 5 MB", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new DocumentDataError("Form dokumen kosong");

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.length;
    if (bytes > limit) {
      await reader.cancel();
      throw new DocumentDataError("Ukuran unggahan maksimal 5 MB", 413);
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
    throw new DocumentDataError("Data unggahan tidak valid");
  }
}

/** File wajib ada dan harus lolos ukuran, ekstensi, serta magic bytes. */
export async function readDocumentFile(
  form: FormData,
  required: boolean
): Promise<{ file: File; mimeType: DocumentMimeType } | null> {
  const value = form.get("file");
  if (!(value instanceof File) || value.size === 0) {
    if (!required) return null;
    throw new DocumentDataError("Pilih file dokumen", 400, {
      file: "Pilih file dokumen",
    });
  }

  const metaError = validateDocumentFileMeta(value);
  if (metaError) {
    throw new DocumentDataError(metaError, 400, { file: metaError });
  }

  const head = new Uint8Array(await value.slice(0, 8).arrayBuffer());
  const checked = validateDocumentFileBytes(head, value.name, value.type);
  if (!checked.ok) {
    throw new DocumentDataError(checked.error, 400, { file: checked.error });
  }

  return { file: value, mimeType: checked.mimeType };
}
