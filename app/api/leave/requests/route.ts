import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  leaveFailure,
  leaveSelfGuard,
  readLeaveAttachment,
  readLeaveForm,
  textValue,
} from "@/lib/leave/http";
import {
  createLeaveRequest,
  getMyLeaveData,
  LeaveDataError,
  uploadLeaveAttachment,
} from "@/lib/leave/repository";
import { validateLeaveInput } from "@/lib/leave/rules";
import type {
  LeaveAttachmentMime,
  LeaveRequestInput,
} from "@/lib/leave/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await leaveSelfGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const form = await readLeaveForm(request);
    const input: LeaveRequestInput = {
      leaveTypeCode: textValue(form.get("leaveTypeCode")),
      startDate: textValue(form.get("startDate")),
      endDate: textValue(form.get("endDate")),
      reason: textValue(form.get("reason")),
      eventNote: textValue(form.get("eventNote")),
    };
    const attachment = await readLeaveAttachment(form, false);

    const data = await getMyLeaveData();

    const validation = validateLeaveInput(input, {
      todayIso: data.todayIso,
      employee: data.employee,
      types: data.types,
      schedule: data.schedule,
      holidays: data.holidays,
      balance: data.balance,
      requests: data.requests,
      hasAttachment: Boolean(attachment),
    });

    if (Object.keys(validation.errors).length > 0) {
      throw new LeaveDataError(
        validation.errors.form ?? "Periksa kembali isian cuti",
        400,
        validation.errors
      );
    }

    if (!data.employee) {
      throw new LeaveDataError("Akun belum tertaut ke data karyawan", 400);
    }

    let stored: {
      path: string;
      fileName: string;
      mimeType: LeaveAttachmentMime;
      size: number;
    } | null = null;

    if (attachment) {
      const uploaded = await uploadLeaveAttachment(
        data.employee.id,
        attachment.file,
        attachment.mimeType
      );
      stored = {
        ...uploaded,
        mimeType: attachment.mimeType,
        size: attachment.file.size,
      };
    }

    await createLeaveRequest(input, stored);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return leaveFailure(error, "gagal mengajukan cuti");
  }
}
