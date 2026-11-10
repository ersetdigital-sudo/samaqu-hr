import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { ACADEMY_URL } from "@/lib/external-links";
import { formatIsoDateID } from "@/lib/employees/format";
import type { OwnEmployeeProfile } from "@/lib/dashboard/repository";
import type { SessionUser } from "@/lib/session";

export function EmployeeDashboard({
  user,
  employee,
}: {
  user: SessionUser;
  employee: OwnEmployeeProfile | null;
}) {
  const items: [string, string][] = employee
    ? [
        ["Nama", employee.fullName],
        ["Email", user.email],
        ["Employee ID", employee.id],
        ["Jabatan", employee.position],
        ["Departemen", employee.department],
        ["Lokasi kerja", employee.location],
        ["Status", employee.status],
        ["Bergabung", formatIsoDateID(employee.joinedAt)],
      ]
    : [["Email", user.email]];

  return (
    <>
      <PageHead title={`Halo, ${user.name}`} subtitle="Dashboard pribadi kamu.">
        <a
          className="btn btn-p"
          href={ACADEMY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Samaqu Academy
          <Icon name="external" style={{ width: 14 }} />
        </a>
      </PageHead>

      <div className="card p-6 max-w-[720px]">
        <div className="font-bold text-[16px] mb-1">Data Karyawan</div>
        <div className="sub text-[13px] mb-5">
          Informasi akun dan data kepegawaian yang tertaut ke akun kamu.
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
          {items.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] sub">{label}</dt>
              <dd className="font-semibold mt-0.5 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        {!employee && (
          <p className="sub text-[13px] mt-5">
            Akun kamu belum tertaut ke data karyawan. Hubungi admin untuk
            menautkannya.
          </p>
        )}
        <p className="sub text-[12px] mt-6">
          Modul kehadiran, cuti, dan payroll belum tersedia. Materi pelatihan
          dan SOP internal tersedia di Samaqu Academy.
        </p>
      </div>
    </>
  );
}
