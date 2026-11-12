"use client";

import { Icon } from "@/components/icons";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { Highlight } from "@/components/organization/highlight";
import {
  ORGANIZATION_ISSUE_DESCRIPTIONS,
  ORGANIZATION_ISSUE_LABELS,
} from "@/lib/organization/issues";
import type { OrganizationNode } from "@/lib/organization/types";

export function OrganizationNodeRow({
  node,
  expanded,
  term,
  viewerEmployeeId,
  showWarnings,
  onToggle,
  onOpen,
}: {
  node: OrganizationNode;
  expanded: Set<string>;
  term: string;
  viewerEmployeeId: string | null;
  showWarnings: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const open = expanded.has(node.id);

  return (
    <div className="flex items-start gap-2 min-w-0">
      {hasChildren ? (
        <button
          type="button"
          className="shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center"
          style={{ borderColor: "var(--line)", background: "#fff" }}
          aria-expanded={open}
          aria-label={`${open ? "Tutup" : "Buka"} cabang ${node.fullName}`}
          onClick={() => onToggle(node.id)}
        >
          <Icon
            name="chevron"
            style={{
              width: 14,
              height: 14,
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform .15s",
            }}
          />
        </button>
      ) : (
        <span className="shrink-0 w-8" aria-hidden="true" />
      )}

      <button
        type="button"
        className="flex-1 min-w-0 text-left p-3 rounded-xl border bg-white"
        style={{ borderColor: "var(--line)" }}
        aria-label={`Buka ringkasan ${node.fullName}`}
        onClick={() => onOpen(node.id)}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-[13px] break-words">
            <Highlight text={node.fullName} term={term} />
          </span>
          {node.id === viewerEmployeeId && (
            <span className="tag t-info">Anda</span>
          )}
          <span className={`tag ${employeeStatusTone(node.status)}`}>
            {node.status}
          </span>
          {showWarnings && node.issue && (
            <span
              className={`tag ${
                node.issue === "cycle" ? "t-bad" : "t-warn"
              }`}
              title={ORGANIZATION_ISSUE_DESCRIPTIONS[node.issue]}
            >
              {ORGANIZATION_ISSUE_LABELS[node.issue]}
            </span>
          )}
        </div>

        <div className="text-[11px] sub mt-0.5 break-words">
          <Highlight text={node.position} term={term} /> · {node.department}
        </div>
        <div className="text-[11px] sub mt-0.5">
          {node.id} · {node.directReports} bawahan
        </div>
      </button>
    </div>
  );
}
