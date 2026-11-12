"use client";

import { Icon } from "@/components/icons";
import { useRecruitment } from "@/components/recruitment-provider";
import { StageTag } from "@/components/stage-tag";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection, FormSectionNav } from "@/components/ui/form-section";
import {
  useDrawerSectionNav,
  type DrawerNavSection,
} from "@/components/ui/use-drawer-section-nav";
import { STAGES, ini } from "@/lib/data";

const CANDIDATE_SECTIONS: DrawerNavSection[] = [
  { id: "candidate-summary", label: "Kandidat" },
  { id: "candidate-details", label: "Detail" },
  { id: "candidate-documents", label: "Dokumen" },
  { id: "candidate-history", label: "Riwayat" },
  { id: "candidate-interview", label: "Wawancara" },
  { id: "candidate-notes", label: "Catatan" },
  { id: "candidate-stage", label: "Ubah Status" },
];

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

const HISTORY_DATES = [
  "10 Okt",
  "12 Okt",
  "15 Okt",
  "18 Okt",
  "20 Okt",
  "24 Okt",
];

export function CandidateDrawer() {
  const { candidates, drawerId, closeD, moveC, toast } = useRecruitment();
  const candidate = candidates.find((item) => item.id === drawerId) ?? null;
  const history = STAGES.slice(0, 6);
  const { bodyRef, activeId, scrollToSection } = useDrawerSectionNav(
    CANDIDATE_SECTIONS,
    Boolean(candidate)
  );

  return (
    <DetailDrawer
      open={Boolean(candidate)}
      title="Detail Kandidat"
      description="Ringkasan kandidat, dokumen, dan riwayat proses."
      size="md"
      onClose={closeD}
      bodyRef={bodyRef}
      subnav={
        <FormSectionNav
          items={CANDIDATE_SECTIONS}
          activeId={activeId}
          onSelect={scrollToSection}
        />
      }
    >
      {candidate && (
        <div className="flex flex-col gap-4">
          <FormSection
            sectionId="candidate-summary"
            icon="users"
            title="Kandidat"
            description="Identitas utama dan tahap saat ini."
          >
            <div className="flex items-center gap-4">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(candidate.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[17px] break-words">
                  {candidate.name}
                </div>
                <div className="sub text-[12px]">{candidate.pos}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StageTag stage={candidate.stage} />
                  <span className="tag t-mute">{candidate.src}</span>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            sectionId="candidate-details"
            icon="file"
            title="Detail Kandidat"
            description="Informasi kontak dan latar belakang."
          >
            <InfoGrid>
              {DETAILS.map(([label, value]) => (
                <InfoItem key={label} label={label} value={value} />
              ))}
            </InfoGrid>
          </FormSection>

          <FormSection
            sectionId="candidate-documents"
            icon="file"
            title="Dokumen"
            description="Berkas yang dilampirkan kandidat."
          >
            <div className="flex flex-col gap-2">
              {DOCUMENTS.map((document) => (
                <div
                  key={document}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "#FAF7F5" }}
                >
                  <Icon name="file" style={{ color: "var(--pink)" }} />
                  <span className="flex-1 text-[13px] font-medium">
                    {document}
                  </span>
                  <button
                    type="button"
                    className="btn btn-g !py-1 !px-3"
                    onClick={() => toast("Pratinjau dokumen")}
                  >
                    Lihat
                  </button>
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection
            sectionId="candidate-history"
            icon="clock"
            title="Riwayat Tahapan"
            description="Perjalanan kandidat sampai tahap saat ini."
          >
            <div>
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
          </FormSection>

          <FormSection
            sectionId="candidate-interview"
            icon="vid"
            title="Jadwal Wawancara"
            description="Jadwal wawancara berikutnya."
          >
            <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{ background: "#FAF7F5" }}
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
          </FormSection>

          <FormSection
            sectionId="candidate-notes"
            icon="book"
            title="Catatan & Evaluasi"
            description="Catatan interviewer dan catatan internal."
          >
            <div
              className="p-4 rounded-xl text-[13px]"
              style={{ background: "#FAF7F5" }}
            >
              <div className="flex justify-between gap-2 mb-1">
                <b>Budi Santoso</b>
                <span className="tag t-ok">Skor 4,3 / 5</span>
              </div>
              <div className="sub">
                Komunikasi jelas dan terstruktur. Pengalaman relevan dengan
                kebutuhan tim. Perlu digali lagi kemampuan mengelola target.
              </div>
            </div>
            <textarea
              className="inp mt-3"
              rows={2}
              placeholder="Tambah catatan internal…"
            />
          </FormSection>

          <FormSection
            sectionId="candidate-stage"
            icon="pipe"
            title="Ubah Status"
            description="Pilih tahap baru kandidat."
          >
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
          </FormSection>
        </div>
      )}
    </DetailDrawer>
  );
}
