"use client";

import { useState } from "react";
import { useRecruitment } from "@/components/recruitment-provider";
import { STAGES } from "@/lib/data";
import { DAY_MS } from "@/lib/recruitment/format";

/** Nilai awal form: tanggal hari ini dan tenggat 30 hari ke depan. */
const todayInput = () => new Date().toISOString().slice(0, 10);
const deadlineInput = () =>
  new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);

export function JobModal() {
  const {
    jobModalOpen,
    closeModals,
    stagesPick,
    toggleStagePick,
    createJob,
  } = useRecruitment();
  const [pos, setPos] = useState("");
  const [dep, setDep] = useState("Customer Service");

  /** Simpan lowongan ke state rekrutmen lalu tutup modal. */
  const submit = (st: "Aktif" | "Draf") => {
    createJob({ pos: pos.trim() || "Posisi Baru", dep, st });
    setPos("");
    setDep("Customer Service");
    closeModals();
  };

  return (
    <div
      className={`modal ${jobModalOpen ? "show" : ""}`}
      id="jobModal"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeModals();
      }}
    >
      <div className="card w-full max-w-[720px] shadow-xl">
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <div>
            <div className="font-bold text-[17px]">Buat Lowongan Baru</div>
            <div className="sub text-[13px]">
              Isi detail posisi. Lowongan disimpan sebagai draf sebelum
              dipublikasikan.
            </div>
          </div>
          <button className="btn btn-g" onClick={closeModals}>
            ✕
          </button>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="lbl">Nama Posisi</label>
            <input
              className="inp"
              placeholder="cth. Customer Service Specialist"
              value={pos}
              onChange={(event) => setPos(event.target.value)}
            />
          </div>
          <div>
            <label className="lbl">Departemen</label>
            <select
              className="inp"
              value={dep}
              onChange={(event) => setDep(event.target.value)}
            >
              <option>Customer Service</option>
              <option>Marketing</option>
              <option>Operasional</option>
              <option>Keuangan</option>
              <option>Teknologi</option>
            </select>
          </div>
          <div>
            <label className="lbl">Tipe Kerja</label>
            <select className="inp">
              <option>Full-time</option>
              <option>Kontrak</option>
              <option>Magang</option>
            </select>
          </div>
          <div>
            <label className="lbl">Lokasi</label>
            <input className="inp" defaultValue="Bandung (On-site)" />
          </div>
          <div>
            <label className="lbl">Jumlah Kebutuhan</label>
            <input className="inp" type="number" defaultValue={2} />
          </div>
          <div>
            <label className="lbl">Tanggal Publikasi</label>
            <input className="inp" type="date" defaultValue={todayInput()} />
          </div>
          <div>
            <label className="lbl">Tenggat Lamaran</label>
            <input
              className="inp"
              type="date"
              defaultValue={deadlineInput()}
            />
          </div>
          <div className="md:col-span-2">
            <label className="lbl">Deskripsi &amp; Kualifikasi</label>
            <textarea
              className="inp"
              rows={4}
              placeholder="Tanggung jawab utama, kualifikasi minimum, dan nilai tambah…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="lbl">Tahapan Seleksi</label>
            <div className="flex flex-wrap gap-2" id="stagePick">
              {STAGES.slice(0, 5).map((stage, i) => (
                <span
                  key={stage}
                  className={`tag ${stagesPick[i] ? "t-pink" : "t-mute"} cursor-pointer`}
                  onClick={() => toggleStagePick(i)}
                >
                  {stage}
                  {i === 3 ? " (opsional)" : ""}
                </span>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="lbl">Kriteria Penilaian Wawancara</label>
            <div className="flex flex-wrap gap-2">
              <span className="tag t-mute">Komunikasi</span>
              <span className="tag t-mute">Kompetensi Teknis</span>
              <span className="tag t-mute">Problem Solving</span>
              <span className="tag t-mute">Kesesuaian Budaya</span>
              <span className="tag t-pink">+ Tambah</span>
            </div>
          </div>
        </div>
        <div
          className="flex justify-end gap-2 px-6 py-4 border-t"
          style={{
            borderColor: "var(--line)",
            background: "#FCFBFA",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <button className="btn btn-g" onClick={() => submit("Draf")}>
            Simpan Draf
          </button>
          <button className="btn btn-p" onClick={() => submit("Aktif")}>
            Publikasikan
          </button>
        </div>
      </div>
    </div>
  );
}
