import { leaveStatusTone } from "@/lib/leave/rules";
import type { LeaveStatus } from "@/lib/leave/types";

export function LeaveStatusTag({ status }: { status: LeaveStatus }) {
  return <span className={`tag ${leaveStatusTone(status)}`}>{status}</span>;
}
