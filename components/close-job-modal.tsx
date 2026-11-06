"use client";

import { useRecruitment } from "@/components/recruitment-provider";

export function CloseJobModal() {
  const {
    jobs,
    closeModalOpen,
    closeJobId,
    closeModals,
    doClose,
  } = useRecruitment();

  const job = jobs.find((item) => item.id === closeJobId);
  const text = job
    ? `Lowongan "${job.pos}" tidak akan menerima lamaran baru. Kandidat yang sudah ada tetap dapat diproses.`
    : "";

  return (
    <div
      className={`modal ${closeModalOpen ? "show" : ""}`}
      id="closeModal"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeModals();
      }}
    >
      <div className="card w-full max-w-[420px] p-6 mt-20">
        <div className="font-bold text-[17px] mb-1">Tutup lowongan?</div>
        <div className="sub mb-5" id="closeTxt">
          {text}
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-g" onClick={closeModals}>
            Batal
          </button>
          <button className="btn btn-p" onClick={doClose}>
            Tutup Lowongan
          </button>
        </div>
      </div>
    </div>
  );
}
