"use client";

import { Icon } from "@/components/icons";
import { useRecruitment } from "@/components/recruitment-provider";
import { KH, KHC, type IconName } from "@/lib/data";

const TABS = ["Semua", "Produk", "SOP", "Kebijakan"];

const CONTINUE_LEARNING: [string, number][] = [
  ["SOP Pelayanan Pelanggan", 60],
  ["Katalog Varian & Harga", 35],
];

const categoryIcon = (category: string): IconName => {
  if (category === "SOP") return "file";
  if (category === "Onboarding") return "onb";
  if (category === "Kebijakan") return "clock";
  if (category === "Marketing") return "rep";
  return "book";
};

const formatViews = (views: number) =>
  new Intl.NumberFormat("id-ID").format(views);

const mostRead = [...KH].sort((a, b) => b.views - a.views).slice(0, 4);

export function KnowledgeView() {
  const { khCat, setKhCat, khQ, setKhQ, toast } = useRecruitment();

  const list = KH.filter(
    (article) =>
      (khCat === "Semua" || article.category === khCat) &&
      article.title.toLowerCase().includes(khQ.toLowerCase())
  );

  return (
    <>
      <div
        className="rounded-2xl p-8 lg:p-10 mb-6 text-white relative overflow-hidden"
        style={{ background: "#111" }}
      >
        <div
          className="absolute -right-16 -top-16 w-72 h-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle,rgba(255,255,255,.10),transparent 70%)",
          }}
        />
        <div
          className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full border"
          style={{ borderColor: "rgba(255,255,255,.08)" }}
        />
        <div className="relative max-w-[640px]">
          <div
            className="text-[12px] font-semibold tracking-wider mb-3"
            style={{ color: "#A8A29E" }}
          >
            KNOWLEDGE HUB
          </div>
          <div className="text-[30px] lg:text-[34px] font-bold tracking-tight leading-tight">
            Semua pengetahuan SAMAQU,
            <br />
            dalam satu tempat.
          </div>
          <div className="mt-2 mb-6" style={{ color: "#BDB6B2" }}>
            Produk, SOP, kebijakan, dan materi training untuk seluruh tim.
          </div>
          <div className="relative">
            <input
              id="khq"
              className="w-full rounded-xl py-3.5 pl-12 pr-28 text-[15px] outline-none"
              style={{ background: "#fff", color: "#111" }}
              placeholder="Cari artikel, SOP, atau produk…"
              value={khQ}
              onChange={(event) => setKhQ(event.target.value)}
            />
            <Icon
              name="search"
              className="absolute left-4 top-[15px]"
              style={{ color: "#8A8380" }}
            />
            <span
              className="absolute right-3 top-[10px] text-[12px] px-2 py-1 rounded-md"
              style={{ background: "#F2F0EF", color: "#6F6669" }}
            >
              Ctrl K
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {KHC.map((category) => (
          <div
            key={category.label}
            className="card p-5 cursor-pointer transition hover:-translate-y-0.5"
            style={
              khCat === category.label
                ? { borderColor: "#111", boxShadow: "0 0 0 1px #111" }
                : undefined
            }
            onClick={() =>
              setKhCat(khCat === category.label ? "Semua" : category.label)
            }
          >
            <div
              className="w-9 h-9 rounded-lg grid place-items-center mb-4"
              style={{ background: "#F2F0EF" }}
            >
              <Icon
                name={categoryIcon(category.label)}
                style={{ width: 17 }}
              />
            </div>
            <div className="font-bold">{category.label}</div>
            <div className="text-[12px] sub mt-1 leading-snug">
              {category.description}
            </div>
            <div className="text-[12px] font-semibold mt-3">
              {`${category.count} artikel`}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0">
          <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
            <div className="font-bold text-[17px]">
              {khCat === "Semua" ? "Artikel Terbaru" : khCat}
            </div>
            <div className="flex bg-[#F1EDEB] p-1 rounded-xl">
              {TABS.map((tab) => (
                <div
                  key={tab}
                  className={`tab ${khCat === tab ? "on" : ""}`}
                  onClick={() => setKhCat(tab)}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            {list.length > 0 ? (
              list.map((article, k) => (
                <div
                  key={article.title}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    k ? "border-t" : ""
                  } cursor-pointer hover:bg-[#FCFAF9]`}
                  style={{ borderColor: "var(--line)" }}
                  onClick={() => toast("Membuka artikel")}
                >
                  <div
                    className="w-11 h-11 rounded-xl grid place-items-center shrink-0"
                    style={{ background: "#F2F0EF" }}
                  >
                    <Icon name="file" style={{ width: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {article.title}
                    </div>
                    <div className="text-[12px] sub mt-0.5">
                      {`${article.author} · diperbarui ${article.updated} · ${article.read} baca`}
                    </div>
                  </div>
                  <span className="tag t-mute hidden sm:inline-flex">
                    {article.category}
                  </span>
                  <span className="text-[12px] sub w-16 text-right hidden md:block">
                    {`${formatViews(article.views)} view`}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-10 text-center sub">
                Tidak ada artikel yang cocok.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 min-w-0">
          <div className="card p-6">
            <div className="font-bold mb-1">Lanjutkan Belajar</div>
            <div className="text-[13px] sub mb-4">
              Materi yang sedang Anda pelajari
            </div>
            {CONTINUE_LEARNING.map(([title, progress]) => (
              <div className="mb-4" key={title}>
                <div className="flex justify-between text-[13px] mb-2">
                  <span className="font-medium">{title}</span>
                  <b>{`${progress}%`}</b>
                </div>
                <div className="bar">
                  <i style={{ width: `${progress}%` }} />
                </div>
              </div>
            ))}
            <button
              className="btn btn-p w-full justify-center mt-1"
              onClick={() => toast("Melanjutkan materi")}
            >
              Lanjutkan
            </button>
          </div>

          <div className="card p-6">
            <div className="font-bold mb-4">Paling Banyak Dibaca</div>
            {mostRead.map((article, k) => (
              <div
                className="flex gap-3 items-start mb-3"
                key={article.title}
              >
                <span
                  className="text-[20px] font-bold w-6"
                  style={{ color: "#CFC8C4" }}
                >
                  {k + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {article.title}
                  </div>
                  <div className="text-[12px] sub">{article.category}</div>
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-4 text-[12px] sub"
            style={{ background: "#F2F0EF" }}
          >
            Knowledge Hub terpisah dari Recruitment. Data kandidat, CV, dan
            evaluasi tidak disimpan di sini.
          </div>
        </div>
      </div>
    </>
  );
}
