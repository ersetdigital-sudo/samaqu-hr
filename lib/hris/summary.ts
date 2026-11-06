/**
 * Angka ringkasan lintas modul untuk Dashboard.
 *
 * Modul selain Recruitment belum punya sumber data, jadi nilainya masih data
 * contoh dan sengaja dikumpulkan di satu tempat agar mudah diganti ke API.
 */
export const HRIS_SUMMARY = {
  employees: {
    total: 128,
    newThisMonth: 3,
  },
  attendance: {
    presentToday: 96,
    late: 4,
  },
  payroll: {
    period: "November 2026",
    progress: 68,
  },
} as const;
