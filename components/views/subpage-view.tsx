import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { findModule } from "@/lib/navigation";

/** Halaman submenu yang sudah punya route, isinya menyusul. */
export function SubpageView({
  moduleId,
  subId,
}: {
  moduleId: string;
  subId: string;
}) {
  const module = findModule(moduleId);
  const item = module?.items.find((entry) => entry.id === subId);
  const siblings =
    module?.items.filter((entry) => entry.id !== subId).slice(0, 4) ?? [];

  if (!module || !item) return null;

  return (
    <>
      <PageHead
        title={item.label}
        subtitle={`Bagian dari modul ${module.label}.`}
      >
        <span className="tag t-warn">Segera hadir</span>
      </PageHead>

      <div className="card p-8 text-center">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center mx-auto"
          style={{ background: "#F2F0EF" }}
        >
          <Icon name={module.icon} style={{ width: 20 }} />
        </div>
        <div className="font-bold mt-4">Halaman {item.label} belum dibangun</div>
        <div className="sub text-[13px] mt-1 max-w-[520px] mx-auto">
          Route <code className="font-semibold">{item.href}</code> sudah aktif
          dan memakai navigasi, sesi, serta aturan akses modul{" "}
          {module.label}. Isi halaman ditambahkan tanpa mengubah struktur
          navigasi.
        </div>
        <Link className="btn btn-g mt-5" href={module.href}>
          Kembali ke {module.label}
        </Link>
      </div>

      {siblings.length > 0 && (
        <div className="mt-6">
          <div className="font-bold mb-3 text-[15px]">
            Halaman lain di {module.label}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {siblings.map((entry) => (
              <Link key={entry.id} href={entry.href} className="card p-4">
                <div className="font-semibold text-[13px]">{entry.label}</div>
                <div className="text-[11px] sub mt-1">Segera</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
