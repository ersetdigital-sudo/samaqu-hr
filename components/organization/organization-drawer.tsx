"use client";

import Link from "next/link";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { ini } from "@/lib/data";
import {
  ORGANIZATION_ISSUE_DESCRIPTIONS,
  ORGANIZATION_ISSUE_LABELS,
} from "@/lib/organization/issues";
import type { OrganizationNode } from "@/lib/organization/types";

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
    <DetailDrawer
      open={Boolean(node)}
      title="Ringkasan Karyawan"
      description="Posisi singkat karyawan pada bagan organisasi."
      size="sm"
      onClose={onClose}
      footer={
        node && canOpenDirectory ? (
          <Link
            prefetch={false}
            className="btn btn-p"
            href={`/employees/direktori?employee=${encodeURIComponent(
              node.id
            )}`}
          >
            Buka di Direktori
          </Link>
        ) : undefined
      }
    >
      {node && (
        <div className="flex flex-col gap-4">
          <FormSection
            icon="users"
            title="Karyawan"
            description="Identitas dan posisi pada bagan."
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(node.fullName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[17px] leading-tight break-words">
                  {node.fullName}
                </div>
                <div className="sub text-[12px] break-words">
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
                className="mb-3 p-3 rounded-xl border text-[12px]"
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

            <InfoGrid>
              <InfoItem label="Nomor karyawan" value={node.id} />
              <InfoItem label="Departemen" value={node.department} />
              <InfoItem label="Jabatan" value={node.position} />
              <InfoItem
                label="Bawahan langsung"
                value={`${node.directReports} orang`}
              />
              <InfoItem
                label="Atasan di bagan"
                value={node.managerName ?? "—"}
              />
              <InfoItem label="Tingkat" value={`Level ${node.depth + 1}`} />
            </InfoGrid>
          </FormSection>
        </div>
      )}
    </DetailDrawer>
  );
}
