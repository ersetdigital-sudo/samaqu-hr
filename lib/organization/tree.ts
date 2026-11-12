/**
 * Pembentukan hutan organisasi dari relasi atasan langsung (manager_id).
 *
 * Murni: tidak menyentuh UI/database. Dipakai halaman Bagan dan nantinya
 * modul Mutasi & Promosi.
 *
 * Aturan:
 *  - Karyawan tanpa atasan = akar; beberapa akar = beberapa pohon.
 *  - Nonaktif hanya ikut bila diminta. Bila atasan Nonaktif disembunyikan,
 *    bawahannya tetap tampil dengan naik ke atasan aktif terdekat/akar.
 *  - Atasan yang tidak ada dan rantai atasan yang berputar tidak error:
 *    node terdampak tetap tampil sebagai akar dengan penanda `issue`.
 */

import type {
  DepartmentGroup,
  OrganizationEmployee,
  OrganizationIssue,
  OrganizationModel,
  OrganizationNode,
  OrganizationSummary,
} from "@/lib/organization/types";

const byName = (a: OrganizationEmployee, b: OrganizationEmployee) =>
  a.fullName.localeCompare(b.fullName, "id");

const isIncluded = (
  employee: OrganizationEmployee,
  includeInactive: boolean
) => includeInactive || employee.status !== "Nonaktif";

/**
 * Anggota siklus pada graf atasan (termasuk node Nonaktif yang mungkin
 * disembunyikan). Satu arah: karyawan → atasan.
 */
export function findCycleMembers(
  employees: OrganizationEmployee[]
): Set<string> {
  const managerById = new Map(
    employees.map((employee) => [employee.id, employee.managerId])
  );
  const state = new Map<string, 1 | 2>();
  const cycles = new Set<string>();

  for (const employee of employees) {
    if (state.get(employee.id) === 2) continue;

    const path: string[] = [];
    const indexById = new Map<string, number>();
    let current: string | null = employee.id;

    while (current !== null && managerById.has(current)) {
      const existing = state.get(current);
      if (existing === 2) break;
      if (existing === 1) {
        const start = indexById.get(current);
        if (start !== undefined) {
          for (const id of path.slice(start)) cycles.add(id);
        }
        break;
      }

      state.set(current, 1);
      indexById.set(current, path.length);
      path.push(current);
      current = managerById.get(current) ?? null;
    }

    for (const id of path) state.set(id, 2);
  }

  return cycles;
}

type ParentResolution = {
  parentId: string | null;
  issue: OrganizationIssue | null;
};

const resolveParent = (
  employee: OrganizationEmployee,
  byId: Map<string, OrganizationEmployee>,
  visibleIds: Set<string>,
  cycleMembers: Set<string>
): ParentResolution => {
  if (cycleMembers.has(employee.id)) {
    return { parentId: null, issue: "cycle" };
  }
  if (!employee.managerId) {
    return { parentId: null, issue: null };
  }

  const seen = new Set<string>([employee.id]);
  let managerId: string | null = employee.managerId;

  while (managerId) {
    if (seen.has(managerId)) {
      return { parentId: null, issue: "cycle" };
    }
    seen.add(managerId);

    const manager = byId.get(managerId);
    if (!manager) {
      return { parentId: null, issue: "missing-manager" };
    }
    if (visibleIds.has(manager.id)) {
      return { parentId: manager.id, issue: null };
    }

    // Atasan Nonaktif yang disembunyikan: naik ke atasannya.
    managerId = manager.managerId;
  }

  return { parentId: null, issue: null };
};

const sortChildren = (node: OrganizationNode) => {
  node.children.sort(byName);
  node.children.forEach(sortChildren);
};

const assignDepth = (node: OrganizationNode, depth: number): number => {
  node.depth = depth;
  node.directReports = node.children.length;
  if (node.children.length === 0) return depth;
  return Math.max(
    ...node.children.map((child) => assignDepth(child, depth + 1))
  );
};

const buildDepartmentGroups = (
  visible: OrganizationEmployee[]
): DepartmentGroup[] => {
  const map = new Map<string, OrganizationEmployee[]>();
  for (const employee of visible) {
    const list = map.get(employee.department) ?? [];
    list.push(employee);
    map.set(employee.department, list);
  }

  return [...map.entries()]
    .map(([department, employees]) => ({
      department,
      employees: [...employees].sort(byName),
      count: employees.length,
    }))
    .sort((a, b) => a.department.localeCompare(b.department, "id"));
};

const buildSummary = (
  visible: OrganizationEmployee[],
  forest: OrganizationNode[]
): OrganizationSummary => {
  const deepest = forest.reduce(
    (max, root) => Math.max(max, assignDepth(root, 0)),
    -1
  );

  return {
    total: visible.length,
    departments: new Set(visible.map((employee) => employee.department)).size,
    deepestLevel: forest.length === 0 ? 0 : deepest + 1,
  };
};

export function buildOrganizationModel(
  employees: OrganizationEmployee[],
  includeInactive: boolean
): OrganizationModel {
  const visible = employees
    .filter((employee) => isIncluded(employee, includeInactive))
    .sort(byName);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const visibleIds = new Set(visible.map((employee) => employee.id));
  const cycleMembers = findCycleMembers(employees);

  const parentById = new Map<string, string | null>();
  const issueById = new Map<string, OrganizationIssue | null>();

  for (const employee of visible) {
    const resolved = resolveParent(
      employee,
      byId,
      visibleIds,
      cycleMembers
    );
    parentById.set(employee.id, resolved.parentId);
    issueById.set(employee.id, resolved.issue);
  }

  const nodes = new Map<string, OrganizationNode>();
  for (const employee of visible) {
    nodes.set(employee.id, {
      ...employee,
      children: [],
      depth: 0,
      directReports: 0,
      issue: issueById.get(employee.id) ?? null,
      managerName: null,
    });
  }

  const forest: OrganizationNode[] = [];
  for (const employee of visible) {
    const node = nodes.get(employee.id);
    if (!node) continue;

    const parentId = parentById.get(employee.id) ?? null;
    const parent = parentId ? nodes.get(parentId) : undefined;

    if (parent) {
      node.managerName = parent.fullName;
      parent.children.push(node);
    } else {
      forest.push(node);
    }
  }

  forest.sort(byName);
  forest.forEach(sortChildren);

  return {
    forest,
    departmentGroups: buildDepartmentGroups(visible),
    summary: buildSummary(visible, forest),
  };
}

export function findNodeById(
  forest: OrganizationNode[],
  id: string | null
): OrganizationNode | null {
  if (!id) return null;

  for (const node of forest) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }

  return null;
}

export function collectAllNodeIds(forest: OrganizationNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: OrganizationNode[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      walk(node.children);
    }
  };
  walk(forest);
  return ids;
}
