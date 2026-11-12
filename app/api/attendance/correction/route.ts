import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  assertSameOrigin,
  attendanceFailure,
  attendanceStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/attendance/http";
import { correctAttendance } from "@/lib/attendance/repository";
import type { CorrectionInput } from "@/lib/attendance/types";
import {
  normalizeTimeInput,
  validateCorrectionInput,
} from "@/lib/attendance/validation";
import { AttendanceDataError } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await attendanceStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const input: CorrectionInput = {
      employeeId: textValue(body.employeeId),
      workDate: textValue(body.workDate),
      checkInTime: normalizeTimeInput(body.checkInTime),
      checkOutTime: normalizeTimeInput(body.checkOutTime),
      reason: textValue(body.reason),
    };

    const errors = validateCorrectionInput(input, {
      todayIso: isoDateJakarta(),
    });
    if (Object.keys(errors).length > 0) {
      throw new AttendanceDataError(
        errors.form ?? "Periksa kembali isian koreksi",
        400,
        errors
      );
    }

    const attendance = await correctAttendance(input);
    return NextResponse.json({ attendance });
  } catch (error) {
    return attendanceFailure(error);
  }
}
