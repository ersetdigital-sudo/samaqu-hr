"use client";

import { EmployeeDocumentsPanel } from "@/components/documents/employee-documents-panel";

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
    <div className={`drawer ${employeeId ? "show" : ""}`}>
      {employeeId && (
        <>
          <div
            className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="font-bold">Dokumen Karyawan</span>
            <button
              className="btn btn-g !px-3"
              onClick={onClose}
              aria-label="Tutup dokumen karyawan"
            >
              ✕
            </button>
          </div>

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
