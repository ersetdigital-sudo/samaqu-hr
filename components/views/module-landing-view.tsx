import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { findModule, isSubItemLive } from "@/lib/navigation";

/**
 * Halaman pembuka modul yang strukturnya sudah terdaftar tetapi halamannya
 * belum dibangun. Submenu resmi modul ditampilkan di sini sebagai peta kerja
 * berikutnya, jadi navigasi tidak pernah menuju halaman kosong.
 */
export function ModuleLandingView({ moduleId }: { moduleId: string }) {
  const module = findModule(moduleId);

  if (!module) return null;

  return (
    <>
      <PageHead title={module.label} subtitle={module.description}>
        <span className="tag t-warn">Tahap persiapan</span>
      </PageHead>

      <div className="card p-6 mb-6">
        <div className="font-bold mb-1">Modul sudah terdaftar di navigasi</div>
        <div className="sub text-[13px] max-w-[720px]">
          {module.label} memakai layout, sidebar, sesi, dan aturan akses yang
          sama dengan Recruitment dan Knowledge Hub. Halaman di bawah ini
          dibangun bertahap tanpa mengubah struktur navigasinya.
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="tag t-mute">
            {module.items.length} halaman direncanakan
          </span>
          <span className="tag t-mute">
            Role: {module.roles.join(", ")}
          </span>
          <span className="tag t-mute">Satu sesi aplikasi</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {module.items.map((item, index) => {
          const live = isSubItemLive(module, item);
          const card = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span
                  className="text-[20px] font-bold leading-none"
                  style={{ color: "#CFC8C4" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={`tag ${live ? "t-ok" : "t-mute"}`}>
                  {live ? "Tersedia" : "Segera"}
                </span>
              </div>
              <div className="font-semibold mt-3">{item.label}</div>
              <div className="text-[12px] sub mt-1">{item.href}</div>
            </>
          );

          return live ? (
            <Link
              key={item.id}
              href={item.href}
              className="card p-5 transition hover:-translate-y-0.5"
            >
              {card}
            </Link>
          ) : (
            <div className="card p-5" key={item.id}>
              {card}
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-[13px] sub">
        Modul yang sudah berjalan:{" "}
        <Link className="font-semibold underline" href="/recruitment/overview">
          Recruitment
        </Link>{" "}
        dan{" "}
        <Link className="font-semibold underline" href="/knowledge-hub/beranda">
          Knowledge Hub
        </Link>
        .
      </div>
    </>
  );
}
