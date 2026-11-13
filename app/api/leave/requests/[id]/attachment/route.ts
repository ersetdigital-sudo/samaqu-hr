import { NextResponse } from "next/server";
import {
  assertUuid,
  leaveFailure,
  leaveReadGuard,
} from "@/lib/leave/http";
import { getLeaveAttachmentSignedUrl } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await leaveReadGuard();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    assertUuid(id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const url = await getLeaveAttachmentSignedUrl(id, guard.user.role, download);

    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return leaveFailure(error, "gagal membuka lampiran cuti");
  }
}
