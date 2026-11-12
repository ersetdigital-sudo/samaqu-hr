import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  attendanceFailure,
  attendanceStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/attendance/http";
import { saveHoliday } from "@/lib/attendance/repository";
import type { HolidayInput } from "@/lib/attendance/types";
import { validateHolidayInput } from "@/lib/attendance/validation";
import { AttendanceDataError } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await attendanceStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const input: HolidayInput = {
      holidayDate: textValue(body.holidayDate),
      name: textValue(body.name),
    };

    const errors = validateHolidayInput(input);
    if (Object.keys(errors).length > 0) {
      throw new AttendanceDataError(
        "Periksa kembali data hari libur",
        400,
        errors
      );
    }

    const holiday = await saveHoliday(input);
    return NextResponse.json({ holiday }, { status: 201 });
  } catch (error) {
    return attendanceFailure(error);
  }
}
