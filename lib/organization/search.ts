/** Pencarian nama/jabatan dan pembukaan cabang pada bagan organisasi. */

import type {
  OrganizationEmployee,
  OrganizationNode,
} from "@/lib/organization/types";

export const normalizeSearchTerm = (value: string) => value.trim().toLowerCase();

export function employeeMatches(
  employee: Pick<OrganizationEmployee, "fullName" | "position">,
  term: string
): boolean {
  const query = normalizeSearchTerm(term);
  if (!query) return false;
  return `${employee.fullName} ${employee.position}`
    .toLowerCase()
    .includes(query);
}

export function collectMatchIds(
  forest: OrganizationNode[],
  term: string
): Set<string> {
  const ids = new Set<string>();
  if (!normalizeSearchTerm(term)) return ids;

  const walk = (nodes: OrganizationNode[]) => {
    for (const node of nodes) {
      if (employeeMatches(node, term)) ids.add(node.id);
      walk(node.children);
    }
  };
  walk(forest);

  return ids;
}

/** Cabang yang harus terbuka agar node hasil pencarian terlihat. */
export function collectAncestorIdsForMatches(
  forest: OrganizationNode[],
  matchIds: Set<string>
): Set<string> {
  const ancestors = new Set<string>();

  const walk = (node: OrganizationNode): boolean => {
    let childMatched = false;
    for (const child of node.children) {
      if (walk(child)) childMatched = true;
    }
    if (childMatched) ancestors.add(node.id);
    return childMatched || matchIds.has(node.id);
  };

  forest.forEach(walk);
  return ancestors;
}

/** Cabang menuju posisi karyawan yang sedang login. */
export function collectViewerAncestors(
  forest: OrganizationNode[],
  viewerId: string | null
): Set<string> {
  const ancestors = new Set<string>();
  if (!viewerId) return ancestors;

  const walk = (node: OrganizationNode, path: string[]): boolean => {
    if (node.id === viewerId) {
      path.forEach((id) => ancestors.add(id));
      return true;
    }
    for (const child of node.children) {
      if (walk(child, [...path, node.id])) return true;
    }
    return false;
  };

  forest.forEach((root) => walk(root, []));
  return ancestors;
}
