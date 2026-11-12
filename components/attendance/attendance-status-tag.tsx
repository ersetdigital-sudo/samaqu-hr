import {
  attendanceDayKindLabel,
  attendanceStatusTone,
} from "@/lib/attendance/rules";
import type { AttendanceDay } from "@/lib/attendance/types";

export function AttendanceStatusTag({ day }: { day: AttendanceDay }) {
  if (!day.status) {
    if (day.dayType === "holiday") {
      return (
        <span className="tag t-info">
          {attendanceDayKindLabel(day.dayType)}
          {day.holidayName ? ` · ${day.holidayName}` : ""}
        </span>
      );
    }
    if (day.dayType === "offday") {
      return <span className="tag t-mute">Non-kerja</span>;
    }
    return <span className="sub text-[12px]">—</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className={`tag ${attendanceStatusTone(day.status)}`}>
        {day.status}
      </span>
      {day.late && day.status !== "Terlambat" && (
        <span className="tag t-warn">Terlambat</span>
      )}
      {day.early && day.status !== "Pulang Cepat" && (
        <span className="tag t-warn">Pulang Cepat</span>
      )}
      {(day.dayType === "holiday" || day.dayType === "offday") && (
        <span className="tag t-mute">
          {attendanceDayKindLabel(day.dayType)}
        </span>
      )}
    </span>
  );
}
