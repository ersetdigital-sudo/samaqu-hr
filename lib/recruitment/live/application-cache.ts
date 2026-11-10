import type { CandidateApplication } from "./types";

const TTL_MS = 30_000;
const cache = new Map<string, { value: CandidateApplication; at: number }>();
const inFlight = new Map<string, Promise<CandidateApplication>>();

export function cachedCandidateApplication(
  id: string,
): CandidateApplication | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.value;
}

export function loadCandidateApplication(
  id: string,
): Promise<CandidateApplication> {
  const cached = cachedCandidateApplication(id);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(id);
  if (pending) return pending;

  const task = fetch(`/api/recruitment/applications/${id}`, {
    cache: "no-store",
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as {
        application?: CandidateApplication;
        error?: string;
      } | null;
      if (!response.ok || !payload?.application)
        throw new Error(payload?.error ?? "Gagal memuat detail pelamar");
      cache.set(id, { value: payload.application, at: Date.now() });
      return payload.application;
    })
    .finally(() => {
      inFlight.delete(id);
    });

  inFlight.set(id, task);
  return task;
}

export function invalidateCandidateApplication(id?: string) {
  if (id) cache.delete(id);
  else cache.clear();
}
