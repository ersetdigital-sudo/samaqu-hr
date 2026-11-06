import {
  AVAILABILITIES,
  EDUCATIONS,
  EXPERIENCE_LENGTHS,
  SKILLS,
  SOURCES,
  type ApplicationDraft,
} from "@/lib/recruitment/live/types";

export function emptyApplication(): ApplicationDraft {
  return {
    full_name: "",
    whatsapp: "",
    email: "",
    birth_date: "",
    city: "",
    education: "",
    has_admin_experience: null,
    last_position: "",
    last_company: "",
    experience_length: "",
    skills: [],
    expected_salary: "",
    start_availability: "",
    source: "",
    portfolio_url: "",
    motivation: "",
    consent: false,
  };
}

function isOption<T extends string>(
  options: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (options as readonly string[]).includes(value)
  );
}

/** Only known, correctly typed fields are restored. Files and consent never persist. */
export function restoreApplication(value: unknown): ApplicationDraft {
  const draft = emptyApplication();
  if (!value || typeof value !== "object" || Array.isArray(value)) return draft;
  const saved = value as Record<string, unknown>;
  const textFields = [
    "full_name",
    "whatsapp",
    "email",
    "birth_date",
    "city",
    "last_position",
    "last_company",
    "portfolio_url",
    "motivation",
  ] as const;
  for (const key of textFields)
    if (typeof saved[key] === "string") draft[key] = saved[key];
  if (isOption(EDUCATIONS, saved.education)) draft.education = saved.education;
  if (typeof saved.has_admin_experience === "boolean")
    draft.has_admin_experience = saved.has_admin_experience;
  if (isOption(EXPERIENCE_LENGTHS, saved.experience_length))
    draft.experience_length = saved.experience_length;
  if (isOption(AVAILABILITIES, saved.start_availability))
    draft.start_availability = saved.start_availability;
  if (isOption(SOURCES, saved.source)) draft.source = saved.source;
  if (
    typeof saved.expected_salary === "number" &&
    Number.isFinite(saved.expected_salary)
  )
    draft.expected_salary = saved.expected_salary;
  if (Array.isArray(saved.skills))
    draft.skills = [
      ...new Set(
        saved.skills.filter((skill): skill is (typeof SKILLS)[number] =>
          isOption(SKILLS, skill),
        ),
      ),
    ];
  if (draft.has_admin_experience !== true) {
    draft.last_position = "";
    draft.last_company = "";
    draft.experience_length = "";
  }
  return draft;
}

export function applicationStorageKey(jobId: string) {
  return `samaqu:karir:application:${jobId}`;
}

export const experienceLabels = {
  "<1 thn": "< 1 tahun",
  "1–2 thn": "1–2 tahun",
  ">2 thn": "> 2 tahun",
} as const;
