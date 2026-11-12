"use client";

import { employeeStatusTone } from "@/components/employees/status-tone";
import { Highlight } from "@/components/organization/highlight";
import { employeeMatches } from "@/lib/organization/search";
import type { DepartmentGroup } from "@/lib/organization/types";

export function OrganizationDepartments({
  groups,
  term,
  viewerEmployeeId,
  onOpen,
}: {
  groups: DepartmentGroup[];
  term: string;
  viewerEmployeeId: string | null;
  onOpen: (id: string) => void;
}) {
  const query = term.trim();

  const filtered = groups
    .map((group) => ({
      ...group,
      employees: query
        ? group.employees.filter((employee) => employeeMatches(employee, term))
        : group.employees,
    }))
    .filter((group) => group.employees.length > 0);

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map((group) => (
        <div className="card p-5" key={group.department}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-[15px] break-words">
              {group.department}
            </div>
            <span className="tag t-mute shrink-0">{group.count} orang</span>
          </div>

          <div className="flex flex-col gap-1.5 mt-3">
            {group.employees.map((employee) => (
              <button
                type="button"
                key={employee.id}
                className="w-full min-w-0 text-left p-2 rounded-lg"
                style={{ background: "#FAF7F5" }}
                aria-label={`Buka ringkasan ${employee.fullName}`}
                onClick={() => onOpen(employee.id)}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[13px] break-words">
                    <Highlight text={employee.fullName} term={term} />
                  </span>
                  {employee.id === viewerEmployeeId && (
                    <span className="tag t-info">Anda</span>
                  )}
                  <span
                    className={`tag ${employeeStatusTone(employee.status)}`}
                  >
                    {employee.status}
                  </span>
                </div>
                <div className="text-[11px] sub mt-0.5 break-words">
                  <Highlight text={employee.position} term={term} /> ·{" "}
                  {employee.id}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
