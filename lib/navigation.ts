/**
 * Sumber tunggal struktur navigasi HRIS Samaqu.
 *
 * Satu aplikasi, banyak modul. Sidebar utama, submenu, breadcrumb, tab mobile,
 * dan pengecekan hak akses semuanya membaca konfigurasi ini, sehingga menambah
 * modul atau halaman cukup dilakukan di satu tempat.
 */

import type { IconName } from "@/lib/data";
import { ACADEMY_URL } from "@/lib/external-links";

export type Role = "admin" | "hr_manager" | "recruiter" | "employee";

export type NavSubItem = {
  /** Dipakai sebagai slug route dan kunci submenu. */
  id: string;
  label: string;
  href: string;
  /** Default: mengikuti role modul induk. */
  roles?: Role[];
  /** Default: mengikuti status modul induk. */
  status?: "live" | "planned";
};

export type NavModule = {
  id: string;
  label: string;
  icon: IconName;
  /** Halaman pembuka modul; boleh berupa URL absolut untuk aplikasi lain. */
  href: string;
  /** Buka link absolut di tab baru tanpa ikut routing internal. */
  external?: boolean;
  description: string;
  /** `live` sudah punya halaman fungsional, `planned` masih kerangka. */
  status: "live" | "planned";
  roles: Role[];
  /** Hanya tampil untuk akun karyawan yang tertaut ke data karyawan. */
  employeeSelf?: boolean;
  /** Hanya tampil untuk role Karyawan (tidak ikut terlihat oleh Admin). */
  employeeOnly?: boolean;
  items: NavSubItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  modules: NavModule[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "utama",
    label: "MENU UTAMA",
    modules: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "grid",
        href: "/",
        description: "Ringkasan lintas modul HRIS Samaqu.",
        status: "live",
        roles: ["admin", "hr_manager", "recruiter", "employee"],
        items: [],
      },
      {
        id: "dokumen-saya",
        label: "Dokumen Saya",
        icon: "file",
        href: "/dokumen-saya",
        description: "Dokumen pribadi karyawan yang diunggah HR.",
        status: "live",
        roles: ["employee"],
        employeeSelf: true,
        items: [],
      },
      {
        id: "organisasi",
        label: "Struktur Organisasi",
        icon: "users",
        href: "/organisasi",
        description: "Bagan atasan-bawahan dan sebaran karyawan per departemen.",
        status: "live",
        roles: ["employee"],
        employeeOnly: true,
        items: [],
      },
      {
        id: "riwayat-jabatan",
        label: "Riwayat Jabatan",
        icon: "clock",
        href: "/riwayat-jabatan",
        description: "Riwayat promosi, mutasi, dan demosi milikmu.",
        status: "live",
        roles: ["employee"],
        employeeOnly: true,
        items: [],
      },
      {
        id: "absensi",
        label: "Absensi",
        icon: "clock",
        href: "/absensi",
        description: "Check-in, check-out, cuti, dan riwayat kehadiran milikmu.",
        status: "live",
        roles: ["employee"],
        employeeOnly: true,
        items: [
          {
            id: "kehadiran",
            label: "Absensi Harian",
            href: "/absensi",
            status: "live",
          },
          { id: "cuti", label: "Cuti & Izin", href: "/absensi/cuti", status: "live" },
          { id: "lembur", label: "Lembur", href: "/absensi/lembur", status: "live" },
        ],
      },
      {
        id: "employees",
        label: "Employee Management",
        icon: "users",
        href: "/employees",
        description: "Data induk karyawan, kontrak, dan struktur organisasi.",
        status: "planned",
        roles: ["hr_manager"],
        items: [
          {
            id: "direktori",
            label: "Direktori Karyawan",
            href: "/employees/direktori",
            status: "live",
          },
          {
            id: "kontrak",
            label: "Kontrak & Masa Kerja",
            href: "/employees/kontrak",
            status: "live",
          },
          {
            id: "organisasi",
            label: "Struktur Organisasi",
            href: "/employees/organisasi",
            status: "live",
          },
          {
            id: "dokumen",
            label: "Dokumen & Berkas",
            href: "/employees/dokumen",
            status: "live",
          },
          {
            id: "mutasi",
            label: "Mutasi & Promosi",
            href: "/employees/mutasi",
            status: "live",
          },
        ],
      },
      {
        id: "recruitment",
        label: "Recruitment",
        icon: "job",
        href: "/recruitment/overview",
        description: "Lowongan, kandidat, pipeline, hingga onboarding.",
        status: "live",
        roles: ["hr_manager", "recruiter"],
        items: [
          { id: "overview", label: "Overview", href: "/recruitment/overview" },
          { id: "lowongan", label: "Lowongan", href: "/recruitment/lowongan" },
          { id: "kandidat", label: "Kandidat", href: "/recruitment/kandidat" },
          { id: "pipeline", label: "Pipeline", href: "/recruitment/pipeline" },
          {
            id: "jadwal",
            label: "Jadwal & Evaluasi",
            href: "/recruitment/jadwal",
          },
          {
            id: "onboarding",
            label: "Onboarding",
            href: "/recruitment/onboarding",
            status: "live",
            roles: ["hr_manager"],
          },
          {
            id: "laporan",
            label: "Laporan",
            href: "/recruitment/laporan",
            status: "live",
          },
        ],
      },
      {
        id: "attendance",
        label: "Attendance & Leave",
        icon: "cal",
        href: "/attendance",
        description: "Kehadiran harian, cuti, izin, dan lembur.",
        status: "planned",
        roles: ["hr_manager"],
        items: [
          {
            id: "kehadiran",
            label: "Kehadiran Harian",
            href: "/attendance/harian",
            status: "live",
          },
          { id: "cuti", label: "Persetujuan Cuti", href: "/attendance/cuti", status: "live" },
          {
            id: "saldo-cuti",
            label: "Saldo Cuti",
            href: "/attendance/cuti/saldo",
            status: "live",
          },
          { id: "lembur", label: "Lembur", href: "/attendance/lembur", status: "live" },
          {
            id: "shift",
            label: "Shift & Jadwal Kerja",
            href: "/attendance/shift",
            status: "live",
          },
          { id: "rekap", label: "Rekap Kehadiran", href: "/attendance/rekap", status: "live" },
        ],
      },
      {
        id: "payroll",
        label: "Payroll",
        icon: "wallet",
        href: "/payroll",
        description: "Penggajian bulanan, komponen gaji, pajak, dan slip.",
        status: "planned",
        roles: ["hr_manager"],
        items: [
          {
            id: "penggajian",
            label: "Penggajian Bulanan",
            href: "/payroll/penggajian",
          },
          { id: "komponen", label: "Komponen Gaji", href: "/payroll/komponen" },
          {
            id: "tunjangan",
            label: "Tunjangan & Potongan",
            href: "/payroll/tunjangan",
          },
          { id: "slip", label: "Slip Gaji", href: "/payroll/slip" },
          { id: "pajak", label: "Pajak & BPJS", href: "/payroll/pajak" },
        ],
      },
      {
        id: "performance",
        label: "Performance Management",
        icon: "target",
        href: "/performance",
        description: "Tujuan, review kinerja, dan penilaian kompetensi.",
        status: "planned",
        roles: ["hr_manager"],
        items: [
          { id: "tujuan", label: "Tujuan & KPI", href: "/performance/tujuan" },
          {
            id: "review",
            label: "Review Kinerja",
            href: "/performance/review",
          },
          {
            id: "feedback",
            label: "Feedback & 1:1",
            href: "/performance/feedback",
          },
          {
            id: "kompetensi",
            label: "Penilaian Kompetensi",
            href: "/performance/kompetensi",
          },
          {
            id: "laporan",
            label: "Laporan Kinerja",
            href: "/performance/laporan",
          },
        ],
      },
      {
        id: "academy",
        label: "Samaqu Academy",
        icon: "book",
        href: ACADEMY_URL,
        external: true,
        description:
          "SOP, training, dan learning path di aplikasi Samaqu Academy.",
        status: "live",
        roles: ["admin", "hr_manager", "recruiter", "employee"],
        items: [],
      },
      {
        id: "reports",
        label: "Reports",
        icon: "rep",
        href: "/reports",
        description: "Laporan lintas modul dan ekspor data HR.",
        status: "planned",
        roles: ["hr_manager"],
        items: [
          { id: "hr", label: "Laporan HR", href: "/reports/hr" },
          {
            id: "recruitment",
            label: "Laporan Recruitment",
            href: "/reports/recruitment",
          },
          {
            id: "kehadiran",
            label: "Laporan Kehadiran",
            href: "/reports/kehadiran",
          },
          { id: "payroll", label: "Laporan Payroll", href: "/reports/payroll" },
          { id: "ekspor", label: "Ekspor Data", href: "/reports/ekspor" },
        ],
      },
    ],
  },
  {
    id: "pengaturan",
    label: "PENGATURAN",
    modules: [
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        href: "/settings",
        description: "Pengaturan aplikasi, pengguna, dan hak akses.",
        status: "planned",
        roles: ["admin", "hr_manager"],
        items: [
          { id: "umum", label: "Umum", href: "/settings/umum", status: "live" },
          {
            id: "pengguna",
            label: "Pengguna & Peran",
            href: "/settings/users",
            roles: ["admin"],
            status: "live",
          },
          { id: "hak-akses", label: "Hak Akses", href: "/settings/hak-akses" },
          { id: "integrasi", label: "Integrasi", href: "/settings/integrasi" },
          {
            id: "notifikasi",
            label: "Notifikasi",
            href: "/settings/notifikasi",
          },
          { id: "audit", label: "Audit Log", href: "/settings/audit" },
        ],
      },
    ],
  },
];

export const ALL_MODULES: NavModule[] = NAV_GROUPS.flatMap(
  (group) => group.modules,
);

/** Modul internal yang punya path sendiri. */
const PATH_MODULES = ALL_MODULES.filter(
  (module) => module.href !== "/" && !module.external,
);

export function findModule(moduleId: string): NavModule | undefined {
  return ALL_MODULES.find((module) => module.id === moduleId);
}

/** Modul yang sedang aktif berdasarkan pathname, termasuk halaman submenu. */
export function findModuleByPath(
  pathname: string | null,
): NavModule | undefined {
  const current = pathname ?? "/";
  const byPath = PATH_MODULES.find(
    (module) =>
      current === `/${module.id}` || current.startsWith(`/${module.id}/`),
  );
  if (byPath) return byPath;
  return ALL_MODULES.find((module) => module.href === current);
}

export function findSubItem(
  module: NavModule | undefined,
  pathname: string | null,
): NavSubItem | undefined {
  const current = pathname ?? "/";
  return module?.items
    .filter(
      (item) => current === item.href || current.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Role superuser: semua modul dan submenu terbuka. */
const SUPERUSER_ROLES: Role[] = ["admin"];

export const isSuperuser = (role: Role | null): boolean =>
  role !== null && SUPERUSER_ROLES.includes(role);

/** Role yang boleh mengelola karyawan dan mengonversi pelamar. */
export const canManageEmployees = (role: Role | null): boolean =>
  role !== null && (isSuperuser(role) || role === "hr_manager");

/** Role yang boleh membuka modul. */
export function canAccess(role: Role | null, module: NavModule): boolean {
  return role !== null && (isSuperuser(role) || module.roles.includes(role));
}

/** Visibilitas modul di navigasi, termasuk modul pribadi karyawan tertaut. */
export function moduleVisibleFor(
  role: Role | null,
  module: NavModule,
  employeeId: string | null,
): boolean {
  if (module.employeeOnly) return role === "employee";
  if (module.employeeSelf) return role === "employee" && Boolean(employeeId);
  return canAccess(role, module);
}

/** Submenu yang terlihat oleh role tertentu. */
export function visibleSubItems(
  role: Role | null,
  module: NavModule,
): NavSubItem[] {
  if (role === null) return [];
  if (isSuperuser(role)) return module.items;
  return module.items.filter((item) =>
    (item.roles ?? module.roles).includes(role),
  );
}

/** Halaman submenu sudah dibangun atau masih penanda "Segera". */
export function isSubItemLive(module: NavModule, item: NavSubItem): boolean {
  return (item.status ?? module.status) === "live";
}

/** Modul siap dipakai bila modul live atau minimal satu submenunya live. */
export function isModuleLive(module: NavModule): boolean {
  return (
    module.status === "live" ||
    module.items.some((item) => isSubItemLive(module, item))
  );
}

/** Apakah role boleh membuka submenu pada path aktif. */
export function subItemAllowed(
  role: Role | null,
  module: NavModule,
  pathname: string | null,
): boolean {
  if (role === null) return false;
  if (isSuperuser(role)) return true;
  const item = findSubItem(module, pathname);
  if (!item) return true;
  return (item.roles ?? module.roles).includes(role);
}
