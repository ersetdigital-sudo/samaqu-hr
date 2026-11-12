import { NextResponse } from "next/server";
import {
  assertDocumentId,
  assertSameOrigin,
  documentFailure,
  documentsStaffGuard,
  readDocumentFile,
  readDocumentForm,
} from "@/lib/documents/http";
import {
  deleteEmployeeDocument,
  DocumentDataError,
  updateEmployeeDocument,
} from "@/lib/documents/repository";
import {
  normalizeDocumentTitle,
  validateDocumentMeta,
} from "@/lib/documents/validation";
import type { DocumentType } from "@/lib/documents/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await documentsStaffGuard();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    assertDocumentId(id);
    assertSameOrigin(request);

    const form = await readDocumentForm(request);
    const meta = {
      docType: form.get("docType"),
      title: form.get("title"),
      validUntil: form.get("validUntil"),
    };
    const errors = validateDocumentMeta(meta);

    if (Object.keys(errors).length > 0) {
      throw new DocumentDataError("Periksa kembali isian dokumen", 400, errors);
    }

    const upload = await readDocumentFile(form, false);
    const validUntil =
      typeof meta.validUntil === "string" && meta.validUntil.trim() !== ""
        ? meta.validUntil.trim()
        : null;

    const result = await updateEmployeeDocument(
      id,
      {
        docType: meta.docType as DocumentType,
        title: normalizeDocumentTitle(meta.title),
        validUntil,
      },
      upload?.file ?? null,
      upload?.mimeType ?? null
    );

    return NextResponse.json({ ok: true, warning: result.warning });
  } catch (error) {
    return documentFailure(error, "gagal memperbarui");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await documentsStaffGuard();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    assertDocumentId(id);
    assertSameOrigin(request);
    await deleteEmployeeDocument(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return documentFailure(error, "gagal menghapus");
  }
}
