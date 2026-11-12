import { NextResponse } from "next/server";
import {
  assertDocumentId,
  documentFailure,
  documentReadGuard,
} from "@/lib/documents/http";
import { getDocumentSignedUrl } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await documentReadGuard();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    assertDocumentId(id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const url = await getDocumentSignedUrl(id, guard.user.role, download);

    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return documentFailure(error, "gagal membuka file");
  }
}
