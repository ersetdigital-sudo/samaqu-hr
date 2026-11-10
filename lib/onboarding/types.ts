import type { EmployeeStatus } from "@/lib/employees/types";

export type OnboardingItem = {
  id: string;
  onboardingId: string;
  label: string;
  done: boolean;
  completedOn: string | null;
  notes: string;
  sortOrder: number;
};

export type OnboardingEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  employeeStatus: EmployeeStatus;
  joinedAt: string;
  createdAt: string;
  items: OnboardingItem[];
};

export type OnboardingEmployeeOption = {
  id: string;
  fullName: string;
  position: string;
  status: EmployeeStatus;
  joinedAt: string;
};

export type OnboardingBoard = {
  entries: OnboardingEntry[];
  available: OnboardingEmployeeOption[];
};

export type OnboardingItemPatch = {
  done?: boolean;
  completedOn?: string | null;
  notes?: string;
};

/** Progres dan status turunan; Selesai bila semua item tercentang. */
export function onboardingProgress(entry: OnboardingEntry) {
  const total = entry.items.length;
  const done = entry.items.filter((item) => item.done).length;
  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    status:
      total > 0 && done === total
        ? ("Selesai" as const)
        : ("Berjalan" as const),
  };
}
