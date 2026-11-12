"use client";

import { EmployeeDocumentsPanel } from "@/components/documents/employee-documents-panel";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { FormSection } from "@/components/ui/form-section";

export function DocumentsDrawer({
  employeeId,
  todayIso,
  onClose,
  onMutated,
}: {
  employeeId: string | null;
  todayIso: string;
  onClose: () => void;
  onMutated: (message: string) => void;
}) {
  return (
    <DetailDrawer
      open={Boolean(employeeId)}
      title="Dokumen Karyawan"
      description="Dokumen pribadi dan riwayat perubahannya."
      size="md"
      onClose={onClose}
    >
      {employeeId && (
        <FormSection
          icon="file"
          title="Dokumen & Berkas"
          description="Dokumen pribadi yang diunggah HR."
        >
          <EmployeeDocumentsPanel
            employeeId={employeeId}
            todayIso={todayIso}
            showEmployeeHeader
            showHeading={false}
            onMutated={onMutated}
          />
        </FormSection>
      )}
    </DetailDrawer>
  );
}
