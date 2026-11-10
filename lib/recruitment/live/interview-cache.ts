import type { InterviewSchedule } from "./types";

const TTL_MS = 30_000;
const cache = new Map<string, { value: InterviewSchedule[]; at: number }>();
const inFlight = new Map<string, Promise<InterviewSchedule[]>>();

export function cachedApplicationInterviews(
  applicationId: string,
): InterviewSchedule[] | null {
  const entry = cache.get(applicationId);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(applicationId);
    return null;
  }
  return entry.value;
}

export function loadApplicationInterviews(
  applicationId: string,
): Promise<InterviewSchedule[]> {
  const cached = cachedApplicationInterviews(applicationId);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(applicationId);
  if (pending) return pending;

  const task = fetch(`/api/recruitment/applications/${applicationId}/interviews`, {
    cache: "no-store",
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as {
        interviews?: InterviewSchedule[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.interviews)
        throw new Error(payload?.error ?? "Gagal memuat jadwal wawancara");
      cache.set(applicationId, { value: payload.interviews, at: Date.now() });
      return payload.interviews;
    })
    .finally(() => {
      inFlight.delete(applicationId);
    });

  inFlight.set(applicationId, task);
  return task;
}

export function invalidateApplicationInterviews(applicationId?: string) {
  if (applicationId) cache.delete(applicationId);
  else cache.clear();
}
