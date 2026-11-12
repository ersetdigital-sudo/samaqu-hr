"use client";

import { EmployeeDocumentsPanel } from "@/components/documents/employee-documents-panel";
import { DrawerHeader } from "@/components/ui/drawer-header";
import { DRAWER_SIZE_CLASS } from "@/components/ui/drawer-sizes";

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
    <div
      className={`drawer ${DRAWER_SIZE_CLASS.md} ${
        employeeId ? "show" : ""
      }`}
    >
      {employeeId && (
        <>
          <DrawerHeader
            title="Dokumen Karyawan"
            onClose={onClose}
            closeLabel="Tutup dokumen karyawan"
          />

          <div className="p-6">
            <EmployeeDocumentsPanel
              employeeId={employeeId}
              todayIso={todayIso}
              showEmployeeHeader
              onMutated={onMutated}
            />
          </div>
        </>
      )}
    </div>
  );
}
