import { NextResponse } from "next/server";
import {
  documentFailure,
  documentsStaffGuard,
  readDocumentFile,
  readDocumentForm,
  assertSameOrigin,
} from "@/lib/documents/http";
import {
  createEmployeeDocument,
  DocumentDataError,
  listEmployeeDocuments,
} from "@/lib/documents/repository";
import {
  normalizeDocumentTitle,
  validateDocumentMeta,
} from "@/lib/documents/validation";
import type { DocumentType } from "@/lib/documents/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await documentsStaffGuard();
  if (guard.response) return guard.response;

  try {
    const documents = await listEmployeeDocuments();
    return NextResponse.json(
      { documents },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return documentFailure(error, "gagal memuat daftar");
  }
}

export async function POST(request: Request) {
  const guard = await documentsStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const form = await readDocumentForm(request);

    const employeeId = String(form.get("employeeId") ?? "").trim();
    const meta = {
      docType: form.get("docType"),
      title: form.get("title"),
      validUntil: form.get("validUntil"),
    };
    const errors = validateDocumentMeta(meta);

    if (!employeeId) errors.employeeId = "Karyawan wajib dipilih";

    const rawFile = form.get("file");
    if (!(rawFile instanceof File) || rawFile.size === 0) {
      errors.file = "Pilih file dokumen";
    }

    if (Object.keys(errors).length > 0) {
      throw new DocumentDataError("Periksa kembali isian dokumen", 400, errors);
    }

    const upload = await readDocumentFile(form, true);
    if (!upload) {
      throw new DocumentDataError("Pilih file dokumen", 400, {
        file: "Pilih file dokumen",
      });
    }

    const validUntil =
      typeof meta.validUntil === "string" && meta.validUntil.trim() !== ""
        ? meta.validUntil.trim()
        : null;

    await createEmployeeDocument(
      {
        employeeId,
        docType: meta.docType as DocumentType,
        title: normalizeDocumentTitle(meta.title),
        validUntil,
      },
      upload.file,
      upload.mimeType
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return documentFailure(error, "gagal mengunggah");
  }
}
