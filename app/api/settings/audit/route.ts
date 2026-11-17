import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  auditFailure,
  dateParam,
  textParam,
} from "@/lib/audit/http";
import { getAuditLog } from "@/lib/audit/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;
    const result = await getAuditLog(
      {
        module: textParam(url.searchParams.get("module")),
        from: dateParam(url.searchParams.get("from")),
        to: dateParam(url.searchParams.get("to")),
        actor: textParam(url.searchParams.get("actor")),
        q: textParam(url.searchParams.get("q")),
      },
      page
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return auditFailure(error, "gagal memuat audit log");
  }
}
