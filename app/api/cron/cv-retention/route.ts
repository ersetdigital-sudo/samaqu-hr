import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processDueCvRetention } from "@/lib/recruitment/live/retention-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[cv-retention] CRON_SECRET belum diatur");
    return NextResponse.json(
      { error: "Konfigurasi cron belum lengkap." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Tidak diizinkan." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await processDueCvRetention();
    console.info(
      `[cv-retention] due=${result.due} deleted=${result.deleted} failed=${result.failed}`,
    );
    return NextResponse.json(result, {
      status: result.failed ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("[cv-retention] proses gagal");
    return NextResponse.json(
      { error: "Pembersihan CV gagal diproses." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
