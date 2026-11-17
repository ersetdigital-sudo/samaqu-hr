import Link from "next/link";
import { PageHead } from "@/components/page-head";
import {
  ACCESS_ROLES,
  ACCESS_ROLE_LABELS,
  buildAccessMatrix,
} from "@/lib/settings/access";

export function AccessMatrixView() {
  const groups = buildAccessMatrix();

  return (
    <>
      <PageHead
        title="Hak Akses"
        subtitle="Matriks baca-saja dari navigasi aplikasi. Perubahan akses dilakukan lewat peran pengguna."
      >
        <Link className="btn btn-g" href="/settings/umum">
          Kembali
        </Link>
      </PageHead>

      <div className="card p-0 overflow-x-auto mb-4">
        <table className="w-full min-w-[820px] text-[12px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--line)" }}>
              <th className="text-left p-3 font-bold">Modul / Submenu</th>
              {ACCESS_ROLES.map((role) => (
                <th
                  className="text-center p-3 font-bold whitespace-nowrap"
                  key={role}
                >
                  {ACCESS_ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows group={group} key={group.id} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <div className="font-bold text-[14px] mb-2">Aturan penting</div>
        <ul className="text-[12px] sub flex flex-col gap-2 list-disc pl-5">
          <li>
            Hak akses dijaga berlapis, termasuk pengecekan peran di database
            dan RLS.
          </li>
          <li>
            Recruiter tidak dapat melihat data karyawan, payroll, atau kinerja.
          </li>
          <li>Karyawan hanya dapat melihat datanya sendiri.</li>
          <li>
            Penilaian kinerja Final baru terlihat karyawan setelah periode
            penilaian ditutup.
          </li>
          <li>
            Hak akses diubah lewat peran di Pengguna & Peran, bukan di halaman
            ini.
          </li>
        </ul>
      </div>
    </>
  );
}

function GroupRows({
  group,
}: {
  group: ReturnType<typeof buildAccessMatrix>[number];
}) {
  return (
    <>
      <tr style={{ background: "#FAF8F6" }}>
        <td
          className="p-2 px-3 text-[10px] font-bold tracking-wide"
          colSpan={5}
          style={{ color: "var(--sub)" }}
        >
          {group.label}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr
          className="border-b last:border-b-0"
          style={{ borderColor: "var(--line)" }}
          key={row.id}
        >
          <td
            className={`p-2.5 px-3 ${
              row.level === 0 ? "font-semibold" : "sub"
            }`}
            style={row.level === 1 ? { paddingLeft: 28 } : undefined}
          >
            {row.label}
          </td>
          {ACCESS_ROLES.map((role) => (
            <td className="p-2.5 text-center" key={role}>
              {row.planned ? (
                <span className="tag t-mute">Segera</span>
              ) : (
                <span className={`tag ${row.roles[role] ? "t-ok" : "t-mute"}`}>
                  {row.roles[role] ? "Bisa" : "Tidak"}
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
