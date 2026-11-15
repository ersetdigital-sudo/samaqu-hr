import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { reportsForRole } from "@/lib/reports/rules";
import type { Role } from "@/lib/navigation";

export function ReportsOverviewView({ role }: { role: Role }) {
  const links = reportsForRole(role);

  return (
    <>
      <PageHead
        title="Laporan"
        subtitle="Ringkasan data lintas modul HRIS. Semua laporan bersifat baca-saja."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {links.map((link) => (
          <Link
            className="card p-5 flex items-start gap-4 hover:shadow-sm"
            href={link.href}
            key={link.id}
          >
            <span className="tag t-mute !p-2 shrink-0">
              <Icon name={link.icon} />
            </span>
            <span className="min-w-0">
              <span className="font-bold block">{link.title}</span>
              <span className="text-[12px] sub block mt-1">
                {link.description}
              </span>
              <span className="text-[12px] font-semibold mt-3 inline-block">
                Buka laporan →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
