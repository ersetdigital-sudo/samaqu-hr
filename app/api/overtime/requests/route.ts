import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  overtimeFailure,
  overtimeSelfGuard,
  readJsonObject,
  textValue,
} from "@/lib/overtime/http";
import {
  createOvertimeRequest,
  getMyOvertimeData,
  OvertimeDataError,
} from "@/lib/overtime/repository";
import { validateOvertimeInput } from "@/lib/overtime/rules";
import type { OvertimeInput } from "@/lib/overtime/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await overtimeSelfGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const input: OvertimeInput = {
      requestDate: textValue(body.requestDate),
      startTime: textValue(body.startTime),
      endTime: textValue(body.endTime),
      workDescription: textValue(body.workDescription),
    };

    const data = await getMyOvertimeData();
    const validation = validateOvertimeInput(input, {
      todayIso: data.todayIso,
      employee: data.employee,
      schedules: data.schedule ? [data.schedule] : [],
      holidays: data.holidays,
      leaveDates: data.leaveDates,
      requests: data.requests,
    });

    if (Object.keys(validation.errors).length > 0) {
      throw new OvertimeDataError(
        validation.errors.form ?? "Periksa kembali isian lembur",
        400,
        validation.errors
      );
    }

    await createOvertimeRequest(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return overtimeFailure(error, "gagal mengajukan lembur");
  }
}
