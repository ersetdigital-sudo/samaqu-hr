"use client";

import { Fragment } from "react";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { ONB, TRAINING, ini } from "@/lib/data";

export function OnboardingView() {
  const { selO, setSelO, todo, toggleTodo, toast } = useRecruitment();
  const employee = ONB[selO];
  const completed = todo.filter((item) => item.done).length;

  return (
    <>
      <PageHead
        title="Onboarding"
        subtitle="Pantau kesiapan karyawan baru, dari dokumen hingga materi training."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {ONB.map((entry, k) => (
          <div
            key={entry.n}
            className="card p-5 cursor-pointer"
            onClick={() => setSelO(k)}
            style={
              selO === k
                ? {
                    borderColor: "var(--pink)",
                    boxShadow: "0 0 0 3px var(--pink-50)",
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="av">{ini(entry.n)}</div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{entry.n}</div>
                <div className="text-[12px] sub truncate">{entry.p}</div>
              </div>
            </div>
            <div className="flex justify-between text-[12px] mb-2">
              <span className="sub">{`Mulai ${entry.start}`}</span>
              <b>{`${entry.pr}%`}</b>
            </div>
            <div className="bar">
              <i style={{ width: `${entry.pr}%` }} />
            </div>
            <div className="text-[12px] sub mt-3">
              PIC: <span style={{ color: "var(--ink)" }}>{entry.pic}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex justify-between mb-4">
            <div className="font-bold text-[16px]">
              {`Checklist · ${employee.n}`}
            </div>
            <span className="sub text-[13px]">
              {`${completed}/${todo.length} selesai`}
            </span>
          </div>
          {["Dokumen", "Tugas"].map((group) => (
            <Fragment key={group}>
              <div className="text-[12px] sub font-bold mt-3 mb-2">
                {group.toUpperCase()}
              </div>
              {todo.map((item, k) =>
                item.group === group ? (
                  <div key={item.label} className="flex items-center gap-3 py-2">
                    <div
                      className={`chk ${item.done ? "on" : ""}`}
                      onClick={() => toggleTodo(k)}
                    >
                      {item.done ? (
                        <svg
                          viewBox="0 0 24 24"
                          style={{
                            width: 12,
                            stroke: "#fff",
                            fill: "none",
                            strokeWidth: 3,
                          }}
                        >
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      ) : null}
                    </div>
                    <span
                      className={`text-[13px] ${
                        item.done ? "sub line-through" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                ) : null
              )}
            </Fragment>
          ))}
        </div>

        <div className="card p-6">
          <div className="flex justify-between items-start mb-1">
            <div className="font-bold text-[16px]">Materi Training</div>
            <span className="tag t-info">
              <Icon name="book" style={{ width: 13 }} />
              dari Knowledge Hub
            </span>
          </div>
          <div className="sub text-[13px] mb-4">
            Materi dikelola di Knowledge Hub. Recruitment hanya menugaskan dan
            memantau progres.
          </div>
          {TRAINING.map((material) => (
            <div
              key={material[0]}
              className="flex items-center gap-3 py-3 border-t"
              style={{ borderColor: "var(--line)" }}
            >
              <div
                className="w-9 h-9 rounded-lg grid place-items-center"
                style={{ background: "var(--pink-50)", color: "var(--pink)" }}
              >
                <Icon name="book" style={{ width: 16 }} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[13px]">{material[0]}</div>
                <div className="text-[12px] sub">{material[1]}</div>
              </div>
              <div className="w-24">
                <div className="bar">
                  <i style={{ width: `${material[2]}%` }} />
                </div>
                <div className="text-[11px] sub text-right mt-1">
                  {`${material[2]}%`}
                </div>
              </div>
            </div>
          ))}
          <button
            className="btn btn-g w-full justify-center mt-4"
            onClick={() => toast("Membuka pemilih materi Knowledge Hub")}
          >
            <Icon name="plus" style={{ width: 16 }} />
            Tugaskan Materi
          </button>
        </div>
      </div>
    </>
  );
}
