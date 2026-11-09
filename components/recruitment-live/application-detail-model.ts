import { STAGES } from "@/lib/data";
import type { JobApplication } from "@/lib/recruitment/live/types";
import { ageLabel, money, whatsappDigits } from "./ui";

/** Label aksi maju per tahap; dipakai detail pelamar dan pipeline. */
export const NEXT_STAGE_LABELS: Record<string, string> = {
  "Lamaran Masuk": "Lanjut ke Screening",
  Screening: "Undang Wawancara",
  Wawancara: "Lanjut ke Tes",
  Tes: "Lanjut ke Offering",
  Offering: "Terima Pelamar",
  Ditolak: "Pulihkan Lamaran",
};

export function nextStageFor(stage: string | undefined): string | undefined {
  if (stage === "Ditolak") return STAGES[0];
  if (!stage || stage === "Diterima") return undefined;
  return STAGES[STAGES.indexOf(stage) + 1];
}

export type ApplicationDetailItem = [
  label: string,
  value: string,
  wide?: "wide",
];

/** Susunan data detail pelamar, satu sumber untuk semua tampilan. */
export function applicationDetailItems(
  application: JobApplication,
): ApplicationDetailItem[] {
  return [
    ["Domisili", application.city],
    ["Usia", ageLabel(application.birth_date)],
    ["Pendidikan", application.education],
    [
      "Pengalaman admin",
      application.has_admin_experience
        ? `Ya${application.experience_length ? `, ${application.experience_length}` : ""}`
        : "Belum",
    ],
    [
      "Pekerjaan terakhir",
      [application.last_position, application.last_company]
        .filter(Boolean)
        .join(" · ") || "Belum ada",
      "wide",
    ],
    [
      "Aplikasi dikuasai",
      application.skills.join(", ") || "—",
      "wide",
    ],
    ["Ekspektasi gaji", money(application.expected_salary)],
    ["Bisa mulai", application.start_availability],
    ["Tahu dari", application.source || "—"],
    ["WhatsApp", `+${whatsappDigits(application.whatsapp)}`],
  ];
}
