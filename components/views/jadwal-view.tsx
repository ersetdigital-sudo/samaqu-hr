"use client";

import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { StageTag } from "@/components/stage-tag";
import { RATING_KEYS } from "@/lib/data";
import { formatMonthYearID } from "@/lib/recruitment/format";

export function JadwalView() {
  const {
    rating,
    setRating,
    rec,
    setRec,
    selSch,
    setSelSch,
    toast,
    interviews,
  } = useRecruitment();

  const average = (
    Object.values(rating).reduce((a, b) => a + b, 0) / 5
  )
    .toFixed(1)
    .replace(".", ",");
  const selected = interviews[selSch] ?? interviews[0];
  const monthLabel = selected
    ? formatMonthYearID(new Date(selected.at))
    : "Belum ada jadwal";

  return (
    <>
      <PageHead
        title="Jadwal & Evaluasi"
        subtitle="Jadwal wawancara dan tes, serta form penilaian kandidat."
      >
        <button
          className="btn btn-p"
          onClick={() => toast("Form jadwal belum tersedia")}
        >
          <Icon name="plus" style={{ width: 16 }} />
          Jadwalkan
        </button>
      </PageHead>

      <div className="grid xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <div className="card">
            <div
              className="flex justify-between items-center px-6 py-4 border-b"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="font-bold">{monthLabel}</div>
              <div className="flex bg-[#F1EDEB] p-1 rounded-xl">
                <div className="tab on">Daftar</div>
                <div
                  className="tab"
                  onClick={() => toast("Tampilan kalender belum tersedia")}
                >
                  Kalender
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Kandidat</th>
                    <th>Interviewer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((schedule, k) => (
                    <tr
                      key={schedule.id}
                      className="cursor-pointer"
                      onClick={() => setSelSch(k)}
                      style={
                        selSch === k
                          ? { background: "var(--pink-50)" }
                          : undefined
                      }
                    >
                      <td className="whitespace-nowrap">
                        <div className="text-[11px] sub font-bold">
                          {schedule.d}
                        </div>
                        <b>{schedule.t}</b>
                      </td>
                      <td>
                        <div className="font-semibold">{schedule.c}</div>
                        <div className="text-[12px] sub">
                          {`${schedule.p} · ${schedule.m}`}
                        </div>
                      </td>
                      <td className="sub">{schedule.i}</td>
                      <td>
                        <StageTag stage={schedule.st} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 card p-6">
          <div className="text-[12px] sub font-semibold">
            FORM PENILAIAN
          </div>
          <div className="font-bold text-[17px]">{selected?.c ?? "—"}</div>
          <div className="sub text-[13px] mb-5">
            {`${selected?.p ?? "—"} · Kriteria posisi`}
          </div>

          {RATING_KEYS.map((key) => (
            <div className="flex items-center justify-between mb-3" key={key}>
              <span className="text-[13px] font-medium">{key}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={`star ${rating[key] >= n ? "on" : ""}`}
                    onClick={() => setRating(key, n)}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div
            className="flex justify-between items-center p-3 rounded-xl my-4"
            style={{ background: "var(--pink-50)" }}
          >
            <span className="font-semibold text-[13px]">Skor rata-rata</span>
            <b className="text-[20px]" style={{ color: "var(--pink)" }}>
              {`${average} / 5`}
            </b>
          </div>

          <label className="lbl">Catatan</label>
          <textarea
            className="inp mb-4"
            rows={3}
            placeholder="Kekuatan, area pengembangan, dan observasi…"
          />

          <label className="lbl">Rekomendasi Keputusan</label>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {["Lanjut", "Pertimbangkan", "Tidak Lanjut"].map((option) => (
              <button
                key={option}
                className={`btn ${
                  rec === option ? "btn-p" : "btn-g"
                } justify-center !px-2`}
                onClick={() => setRec(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <button
            className="btn btn-p w-full justify-center"
            onClick={() => toast("Evaluasi terkirim (simulasi)")}
          >
            Kirim Evaluasi
          </button>
        </div>
      </div>
    </>
  );
}
