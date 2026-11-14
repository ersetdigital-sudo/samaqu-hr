import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  numberValue,
  performanceFailure,
  performanceUserGuard,
  readJsonObject,
  textValue,
} from "@/lib/performance/http";
import {
  PerformanceDataError,
  savePerformanceDraft,
} from "@/lib/performance/repository";
import type { PerformanceReviewScoreInput } from "@/lib/performance/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseScores(value: unknown): PerformanceReviewScoreInput[] {
  if (!Array.isArray(value)) {
    throw new PerformanceDataError("Data skor penilaian tidak valid", 400);
  }
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new PerformanceDataError("Data skor penilaian tidak valid", 400);
    }
    const item = raw as Record<string, unknown>;
    const scoreId = textValue(item.scoreId);
    if (!UUID.test(scoreId)) {
      throw new PerformanceDataError("Aspek penilaian tidak valid", 400);
    }
    let score: number | null = null;
    if (item.score !== null && item.score !== undefined && item.score !== "") {
      const parsed = numberValue(item.score);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        throw new PerformanceDataError("Skor harus berupa angka 1 sampai 5", 400);
      }
      score = parsed;
    }
    const note = textValue(item.note);
    if (note.length > 2000) {
      throw new PerformanceDataError("Catatan aspek maksimal 2000 karakter", 400);
    }
    return { scoreId, score, note };
  });
}

function noteValue(value: unknown, label: string): string {
  const text = textValue(value);
  if (text.length > 4000) {
    throw new PerformanceDataError(`${label} maksimal 4000 karakter`, 400);
  }
  return text;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await performanceUserGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);
    const body = await readJsonObject(request);
    await savePerformanceDraft(id, {
      scores: parseScores(body.scores),
      achievementNotes: noteValue(body.achievementNotes, "Catatan Pencapaian Utama"),
      strengths: noteValue(body.strengths, "Kekuatan"),
      improvementAreas: noteValue(body.improvementAreas, "Area Perbaikan"),
      generalNotes: noteValue(body.generalNotes, "Catatan Umum"),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return performanceFailure(error, "gagal menyimpan draft penilaian");
  }
}
