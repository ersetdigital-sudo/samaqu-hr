import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  attendanceFailure,
  attendanceStaffGuard,
  integerValue,
  readJsonObject,
  textValue,
} from "@/lib/attendance/http";
import {
  getScheduleBoard,
  updateWorkSchedule,
} from "@/lib/attendance/repository";
import type { ScheduleInput } from "@/lib/attendance/types";
import { validateScheduleInput } from "@/lib/attendance/validation";
import { AttendanceDataError } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await attendanceStaffGuard();
  if (guard.response) return guard.response;

  try {
    const board = await getScheduleBoard();
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return attendanceFailure(error);
  }
}

export async function PATCH(request: Request) {
  const guard = await attendanceStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const workDays = Array.isArray(body.workDays)
      ? body.workDays
          .map((value) => integerValue(value))
          .filter((value) => Number.isFinite(value))
      : [];

    const input: ScheduleInput = {
      workDays,
      startTime: textValue(body.startTime),
      endTime: textValue(body.endTime),
      breakMinutes: integerValue(body.breakMinutes),
      lateToleranceMinutes: integerValue(body.lateToleranceMinutes),
    };

    const errors = validateScheduleInput(input);
    if (Object.keys(errors).length > 0) {
      throw new AttendanceDataError(
        "Periksa kembali jadwal kerja",
        400,
        errors
      );
    }

    const schedule = await updateWorkSchedule(input);
    return NextResponse.json({ schedule });
  } catch (error) {
    return attendanceFailure(error);
  }
}
