"use client";

import { Icon } from "@/components/icons";
import { useRecruitment } from "@/components/recruitment-provider";
import { StageTag } from "@/components/stage-tag";
import { DrawerHeader } from "@/components/ui/drawer-header";
import { DRAWER_SIZE_CLASS } from "@/components/ui/drawer-sizes";
import { STAGES, ini } from "@/lib/data";

const DETAILS = [
  ["Email", "kandidat@mail.com"],
  ["Domisili", "Bandung"],
  ["Pendidikan", "S1 Manajemen"],
  ["Pengalaman", "3 tahun"],
];

const DOCUMENTS = [
  "CV_Kandidat.pdf · 240 KB",
  "Portofolio.pdf · 1,2 MB",
];

const HISTORY_DATES = ["10 Okt", "12 Okt", "15 Okt", "18 Okt", "20 Okt", "24 Okt"];

export function CandidateDrawer() {
  const { candidates, drawerId, closeD, moveC, toast } = useRecruitment();
  const candidate = candidates.find((item) => item.id === drawerId) ?? null;
  const history = STAGES.slice(0, 6);

  return (
    <div
      className={`drawer ${DRAWER_SIZE_CLASS.md} ${
        drawerId !== null ? "show" : ""
      }`}
      id="drawer"
    >
      {candidate ? (
        <>
          <DrawerHeader
            title="Detail Kandidat"
            onClose={closeD}
            closeLabel="Tutup detail kandidat"
          />
          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(candidate.name)}
              </div>
              <div className="flex-1">
                <div className="font-bold text-[19px]">{candidate.name}</div>
                <div className="sub">{candidate.pos}</div>
                <div className="mt-2 flex gap-2">
                  <StageTag stage={candidate.stage} />
                  <span className="tag t-mute">{candidate.src}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px] mb-6">
              {DETAILS.map(([label, value]) => (
                <div
                  key={label}
                  className="p-3 rounded-xl"
                  style={{ background: "#FAF7F5" }}
                >
                  <div className="sub text-[12px]">{label}</div>
                  <div className="font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <div className="font-bold mb-3">Dokumen</div>
            <div className="flex flex-col gap-2 mb-6">
              {DOCUMENTS.map((document) => (
                <div
                  key={document}
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ borderColor: "var(--line)" }}
                >
                  <Icon name="file" style={{ color: "var(--pink)" }} />
                  <span className="flex-1 text-[13px] font-medium">
                    {document}
                  </span>
                  <button
                    className="btn btn-g !py-1 !px-3"
                    onClick={() => toast("Pratinjau dokumen")}
                  >
                    Lihat
                  </button>
                </div>
              ))}
            </div>
            <div className="font-bold mb-3">Riwayat Tahapan</div>
            <div className="mb-6">
              {history.map((stage, i) => {
                const idx = STAGES.indexOf(candidate.stage);
                const done =
                  candidate.stage === "Ditolak" ? i < 4 : i <= idx;
                return (
                  <div className="flex gap-3" key={stage}>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-3 h-3 rounded-full mt-1"
                        style={{
                          background: done ? "var(--pink)" : "#E2DBD8",
                        }}
                      />
                      {i < 5 ? (
                        <div
                          className="w-px flex-1"
                          style={{ background: "#E8E1DE", minHeight: 22 }}
                        />
                      ) : null}
                    </div>
                    <div className="pb-3 text-[13px]">
                      <span className={done ? "font-semibold" : "sub"}>
                        {stage}
                      </span>
                      {done ? (
                        <span className="sub">
                          {` · ${HISTORY_DATES[i]}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="font-bold mb-3">Jadwal Wawancara</div>
            <div
              className="p-4 rounded-xl border mb-6 flex items-center gap-3"
              style={{ borderColor: "var(--line)" }}
            >
              <Icon name="vid" style={{ color: "var(--pink)" }} />
              <div className="flex-1 text-[13px]">
                <b>Wawancara User</b>
                <div className="sub">
                  Sen, 20 Okt 2026 · 10:00–11:00 · Google Meet
                </div>
                <div className="sub">Interviewer: Budi Santoso, Ardo</div>
              </div>
            </div>
            <div className="font-bold mb-3">
              Catatan &amp; Evaluasi Interviewer
            </div>
            <div
              className="p-4 rounded-xl mb-3 text-[13px]"
              style={{ background: "#FAF7F5" }}
            >
              <div className="flex justify-between mb-1">
                <b>Budi Santoso</b>
                <span className="tag t-ok">Skor 4,3 / 5</span>
              </div>
              <div className="sub">
                Komunikasi jelas dan terstruktur. Pengalaman relevan dengan
                kebutuhan tim. Perlu digali lagi kemampuan mengelola target.
              </div>
            </div>
            <textarea
              className="inp mb-6"
              rows={2}
              placeholder="Tambah catatan internal…"
            />
            <div className="font-bold mb-3">Ubah Status</div>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  className={`btn ${
                    stage === candidate.stage ? "btn-p" : "btn-g"
                  } !py-1.5 !px-3`}
                  onClick={() => moveC(candidate.id, stage)}
                >
                  {stage}
                </button>
              ))}
            </div>
            <div className="text-[12px] sub mt-4">
              Perubahan status hanya tersimpan di sesi browser ini dan belum
              ada notifikasi yang dikirim ke kandidat.
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
