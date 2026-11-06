import { NextResponse } from "next/server";
import type { FieldErrors } from "@/lib/recruitment/live/types";

export class RecruitmentError extends Error {
  constructor(message: string, readonly status = 400, readonly fields?: FieldErrors) { super(message); }
}
export function recruitmentFailure(error: unknown) {
  if (error instanceof RecruitmentError) return NextResponse.json({ error: error.message, ...(error.fields ? {fields:error.fields} : {}) }, { status: error.status, headers:{"Cache-Control":"no-store"} });
  return NextResponse.json({error:"Terjadi kesalahan. Silakan coba lagi."},{status:500,headers:{"Cache-Control":"no-store"}});
}
export function dbFailure(error: {code?:string;message?:string}): never {
  if (error.code === "42501") throw new RecruitmentError("Akses ditolak",403);
  if (error.code === "23505") throw new RecruitmentError("Data sudah terdaftar. Periksa slug atau lamaran yang sudah dikirim.",409);
  if (error.code === "23514" || error.code === "P0001") throw new RecruitmentError("Data atau perubahan status tidak valid. Lowongan mungkin sudah ditutup.",400);
  throw new RecruitmentError("Gagal mengakses data rekrutmen. Silakan coba lagi.",500);
}
export const assertId = (id:string) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new RecruitmentError("Data tidak ditemukan",404); };
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new RecruitmentError("Asal permintaan tidak valid",403);
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 50000) throw new RecruitmentError("Data terlalu besar",413);
  const raw = await request.text();
  if (raw.length > 50000) throw new RecruitmentError("Data terlalu besar",413);
  try { return JSON.parse(raw) as unknown; } catch { throw new RecruitmentError("Data tidak valid"); }
}
