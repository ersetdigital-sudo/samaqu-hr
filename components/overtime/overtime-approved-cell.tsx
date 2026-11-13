import { TwoLineCell } from "@/components/ui/data-table";
import { overtimeHoursLabel } from "@/lib/overtime/rules";
import type { OvertimeRequest } from "@/lib/overtime/types";

/** Kolom "Disetujui" yang konsisten untuk halaman karyawan dan HR. */
export function OvertimeApprovedCell({
  request,
}: {
  request: OvertimeRequest;
}) {
  if (request.status === "Disetujui") {
    return (
      <TwoLineCell
        primary={
          request.approvedMinutes !== null
            ? overtimeHoursLabel(request.approvedMinutes)
            : "—"
        }
        secondary={
          request.equivalentMinutes !== null
            ? `${overtimeHoursLabel(request.equivalentMinutes)} ekuivalen`
            : "Disetujui"
        }
      />
    );
  }

  if (request.status === "Menunggu") {
    return <TwoLineCell primary="—" secondary="Menunggu persetujuan" />;
  }

  return (
    <TwoLineCell
      primary="—"
      secondary={request.status === "Ditolak" ? "Ditolak" : "Dibatalkan"}
    />
  );
}
