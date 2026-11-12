import { PageHead } from "@/components/page-head";
import { PositionHistoryTimeline } from "@/components/position-history/position-history-timeline";
import type { PositionHistoryEntry } from "@/lib/position-history/types";

export function MyPositionHistoryView({
  linked,
  employeeName,
  history,
}: {
  linked: boolean;
  employeeName: string | null;
  history: PositionHistoryEntry[];
}) {
  if (!linked) {
    return (
      <>
        <PageHead
          title="Riwayat Jabatan"
          subtitle="Riwayat promosi, mutasi, dan demosi milikmu."
        />
        <div className="card p-6 max-w-[640px]">
          <div className="font-bold text-[15px]">Akun belum tertaut</div>
          <div className="sub text-[13px] mt-2">
            Akun kamu belum tertaut ke data karyawan, sehingga riwayat jabatan
            belum bisa ditampilkan. Hubungi admin HR untuk menautkan akunmu.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Riwayat Jabatan"
        subtitle={
          employeeName
            ? `Riwayat perubahan posisi ${employeeName}. Hanya bisa dilihat.`
            : "Riwayat perubahan posisi kamu. Hanya bisa dilihat."
        }
      />

      <div className="card p-4 mb-5 text-[12px] sub">
        Riwayat dicatat oleh HR Manager dan tidak bisa diubah atau dihapus.
      </div>

      <div className="card p-6">
        {history.length > 0 ? (
          <PositionHistoryTimeline entries={history} />
        ) : (
          <div className="text-center py-4">
            <div className="font-semibold text-[14px]">
              Belum ada riwayat jabatan
            </div>
            <div className="sub text-[13px] mt-1">
              Perubahan jabatan, departemen, atasan, atau lokasi kerja akan
              muncul di sini.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
