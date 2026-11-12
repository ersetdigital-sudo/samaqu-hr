"use client";

import { OrganizationNodeRow } from "@/components/organization/organization-node-row";
import type { OrganizationNode } from "@/lib/organization/types";

function TreeNode({
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
  const open = expanded.has(node.id);

  return (
    <div className="min-w-0">
      <OrganizationNodeRow
        node={node}
        expanded={expanded}
        term={term}
        viewerEmployeeId={viewerEmployeeId}
        showWarnings={showWarnings}
        onToggle={onToggle}
        onOpen={onOpen}
      />

      {open && node.children.length > 0 && (
        <div
          className="mt-2 ml-3 sm:ml-5 border-l pl-3 sm:pl-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex flex-col gap-2">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                expanded={expanded}
                term={term}
                viewerEmployeeId={viewerEmployeeId}
                showWarnings={showWarnings}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrganizationTree({
  forest,
  expanded,
  term,
  viewerEmployeeId,
  showWarnings,
  onToggle,
  onOpen,
}: {
  forest: OrganizationNode[];
  expanded: Set<string>;
  term: string;
  viewerEmployeeId: string | null;
  showWarnings: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {forest.map((root) => (
        <div className="card p-4" key={root.id}>
          <TreeNode
            node={root}
            expanded={expanded}
            term={term}
            viewerEmployeeId={viewerEmployeeId}
            showWarnings={showWarnings}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        </div>
      ))}
    </div>
  );
}
