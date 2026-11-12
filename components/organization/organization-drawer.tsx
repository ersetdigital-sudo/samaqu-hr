"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { ini } from "@/lib/data";
import {
  ORGANIZATION_ISSUE_DESCRIPTIONS,
  ORGANIZATION_ISSUE_LABELS,
} from "@/lib/organization/issues";
import type { OrganizationNode } from "@/lib/organization/types";

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: "#FAF7F5" }}>
      <div className="sub text-[11px]">{label}</div>
      <div className="font-semibold text-[13px] break-words">{value}</div>
    </div>
  );
}

export function OrganizationDrawer({
  node,
  canOpenDirectory,
  showWarnings,
  onClose,
}: {
  node: OrganizationNode | null;
  canOpenDirectory: boolean;
  showWarnings: boolean;
  onClose: () => void;
}) {
  return (
    <div className={`drawer ${node ? "show" : ""}`}>
      {node && (
        <>
          <div
            className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="font-bold">Ringkasan Karyawan</span>
            <button
              className="btn btn-g !px-3"
              onClick={onClose}
              aria-label="Tutup ringkasan karyawan"
            >
              ✕
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(node.fullName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[19px] leading-tight break-words">
                  {node.fullName}
                </div>
                <div className="sub text-[13px] break-words">
                  {node.position}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`tag ${employeeStatusTone(node.status)}`}>
                    {node.status}
                  </span>
                  <span className="tag t-mute">{node.id}</span>
                </div>
              </div>
            </div>

            {showWarnings && node.issue && (
              <div
                className="mb-4 p-3 rounded-xl border text-[12px]"
                style={{
                  borderColor: "#E8D3B8",
                  background: "#FFF7E6",
                  color: "#8A5A12",
                }}
              >
                <div className="font-semibold">
                  {ORGANIZATION_ISSUE_LABELS[node.issue]}
                </div>
                <div className="mt-1">
                  {ORGANIZATION_ISSUE_DESCRIPTIONS[node.issue]}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Info label="Nomor karyawan" value={node.id} />
              <Info label="Departemen" value={node.department} />
              <Info label="Jabatan" value={node.position} />
              <Info
                label="Bawahan langsung"
                value={`${node.directReports} orang`}
              />
              <Info
                label="Atasan di bagan"
                value={node.managerName ?? "—"}
              />
              <Info label="Tingkat" value={`Level ${node.depth + 1}`} />
            </div>

            {canOpenDirectory && (
              <div className="flex flex-wrap gap-2 mt-5">
                <Link
                  prefetch={false}
                  className="btn btn-p"
                  href={`/employees/direktori?employee=${encodeURIComponent(
                    node.id
                  )}`}
                >
                  Buka di Direktori
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
