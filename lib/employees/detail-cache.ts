import type { EmployeeDetail } from "./types";

const TTL_MS = 30_000;
const cache = new Map<string, { detail: EmployeeDetail; cachedAt: number }>();
const inFlight = new Map<string, Promise<EmployeeDetail>>();
const versions = new Map<string, number>();
let epoch = 0;

const versionOf = (id: string) => versions.get(id) ?? 0;

export function cachedEmployeeDetail(id: string): EmployeeDetail | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.detail;
}

/** Satu request jaringan per karyawan; prefetch hover dan drawer berbagi promise. */
export function loadEmployeeDetail(id: string): Promise<EmployeeDetail> {
  const cached = cachedEmployeeDetail(id);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(id);
  if (pending) return pending;

  const version = versionOf(id);
  const startEpoch = epoch;
  const task = fetch(`/api/employees/${id}`, { cache: "no-store" })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as {
        employee?: EmployeeDetail;
        error?: string;
      } | null;
      if (!response.ok || !payload?.employee)
        throw new Error(
          payload?.error ?? "Gagal memuat detail karyawan",
        );
      if (epoch === startEpoch && versionOf(id) === version)
        cache.set(id, { detail: payload.employee, cachedAt: Date.now() });
      return payload.employee;
    })
    .finally(() => {
      inFlight.delete(id);
    });

  inFlight.set(id, task);
  return task;
}

export function invalidateEmployeeDetail(id?: string) {
  if (!id) {
    epoch += 1;
    cache.clear();
    inFlight.clear();
    return;
  }
  versions.set(id, versionOf(id) + 1);
  cache.delete(id);
  inFlight.delete(id);
}
