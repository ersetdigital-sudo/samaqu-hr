import {
  overtimeDayTypeLabel,
  overtimeStatusTone,
} from "@/lib/overtime/rules";
import type { OvertimeDayType, OvertimeStatus } from "@/lib/overtime/types";

export function OvertimeStatusTag({ status }: { status: OvertimeStatus }) {
  return <span className={`tag ${overtimeStatusTone(status)}`}>{status}</span>;
}

export function OvertimeDayTag({ dayType }: { dayType: OvertimeDayType }) {
  const tone =
    dayType === "holiday"
      ? "t-info"
      : dayType === "restday"
        ? "t-warn"
        : "t-mute";
  return (
    <span className={`tag ${tone}`}>{overtimeDayTypeLabel(dayType)}</span>
  );
}
