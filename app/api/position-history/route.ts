import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  positionHistoryFailure,
  positionHistoryGuard,
  readPositionChangePayload,
} from "@/lib/position-history/http";
import {
  getPositionHistoryBoard,
  recordPositionChange,
} from "@/lib/position-history/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await positionHistoryGuard();
  if (guard.response) return guard.response;

  try {
    const board = await getPositionHistoryBoard();
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return positionHistoryFailure(error);
  }
}

export async function POST(request: Request) {
  const guard = await positionHistoryGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const input = await readPositionChangePayload(request);
    await recordPositionChange(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return positionHistoryFailure(error);
  }
}
