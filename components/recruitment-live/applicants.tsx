"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES } from "@/lib/data";
import type {
  ApplicationPage,
  JobApplication,
  JobPosting,
} from "@/lib/recruitment/live/types";
import {
  ageLabel,
  api,
  Badge,
  ConfirmDialog,
  ErrorBox,
  Icon,
  initials,
  money,
  relativeTime,
  whatsappDigits,
} from "./ui";
import { useApplicationNotes } from "./use-application-notes";

type Filter = { search: string; stage: string; page: number };
const nextLabels: Record<string, string> = {
  "Lamaran Masuk": "Lanjut ke Screening",
  Screening: "Undang Wawancara",
  Wawancara: "Lanjut ke Tes",
  Tes: "Lanjut ke Offering",
  Offering: "Terima Pelamar",
  Ditolak: "Pulihkan Lamaran",
};

export function Applicants({
  job,
  initial,
  initialError,
}: {
  job: JobPosting;
  initial: ApplicationPage;
  initialError?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<Filter>({
    search: "",
    stage: "",
    page: 1,
  });
  const filterRef = useRef(filter);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [selected, setSelected] = useState<JobApplication | null>(
    initial.applications[0] ?? null,
  );
  const selectedRef = useRef<JobApplication | null>(
    initial.applications[0] ?? null,
  );
  const [reviewError, setReviewError] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [stageError, setStageError] = useState("");
  const [stageBusy, setStageBusy] = useState(false);
  const stageBusyRef = useRef(false);
  const [reject, setReject] = useState<JobApplication | null>(null);
  const requestId = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const selectionId = useRef(0);
  const reviewing = useRef(new Set<string>());
  const reviewed = useRef(new Set<string>());
  const mounted = useRef(true);
  const notes = useApplicationNotes((id, note) => {
    setData((current) => ({
      ...current,
      applications: current.applications.map((item) =>
        item.id === id ? { ...item, internal_note: note } : item,
      ),
    }));
    if (selectedRef.current?.id === id) {
      selectedRef.current = { ...selectedRef.current, internal_note: note };
      setSelected(selectedRef.current);
    }
  });
  const load = useCallback(
    async (next: Filter) => {
      const version = ++requestId.current;
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          search: next.search,
          stage: next.stage,
          page: String(next.page),
        });
        const result = await api<ApplicationPage>(
          `/api/recruitment/jobs/${job.id}/applications?${query}`,
          { signal: controller.signal },
        );
        if (version !== requestId.current || !mounted.current) return;
        setData(result);
        if (!result.applications.length && next.page > 1) {
          const previous = {
            ...next,
            page: Math.max(1, Math.ceil(result.total / result.page_size)),
          };
          filterRef.current = previous;
          setFilter(previous);
        }
      } catch (cause) {
        if (
          version !== requestId.current ||
          controller.signal.aborted ||
          !mounted.current
        )
          return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Daftar pelamar tidak dapat dimuat.",
        );
      } finally {
        if (version === requestId.current && mounted.current) setLoading(false);
      }
    },
    [job.id],
  );
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    void load(filter);
  }, [filter, load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filterRef.current.search) {
        const next = { ...filterRef.current, search, page: 1 };
        filterRef.current = next;
        setFilter(next);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestController.current?.abort();
      selectionId.current++;
    };
  }, []);
  useEffect(() => {
    if (notes.hasUnsaved()) void notes.flush();
  }, [notes.flush, notes.hasUnsaved]);

  function mergeApplication(
    application: JobApplication,
    patch: Partial<JobApplication>,
  ) {
    const wasCounted = reviewed.current.has(application.id);
    if (patch.reviewed_at) reviewed.current.add(application.id);
    setData((current) => {
      const prior =
        current.applications.find((item) => item.id === application.id) ||
        application;
      const counts = { ...current.stage_counts };
      if (patch.stage && patch.stage !== prior.stage) {
        counts[prior.stage] = Math.max(0, (counts[prior.stage] || 0) - 1);
        counts[patch.stage] = (counts[patch.stage] || 0) + 1;
      }
      const justReviewed =
        !!patch.reviewed_at && !prior.reviewed_at && !wasCounted;
      return {
        ...current,
        unreviewed: Math.max(0, current.unreviewed - (justReviewed ? 1 : 0)),
        stage_counts: counts,
        applications: current.applications.map((item) =>
          item.id === application.id ? { ...item, ...patch } : item,
        ),
      };
    });
    if (selectedRef.current?.id === application.id) {
      selectedRef.current = { ...selectedRef.current, ...patch };
      setSelected(selectedRef.current);
    }
  }
  async function markReviewed(application: JobApplication) {
    if (
      application.reviewed_at ||
      reviewed.current.has(application.id) ||
      reviewing.current.has(application.id)
    )
      return;
    reviewing.current.add(application.id);
    try {
      const result = await api<{ application: JobApplication }>(
        `/api/recruitment/applications/${application.id}`,
        { method: "PATCH", body: JSON.stringify({ reviewed: true }) },
      );
      if (!mounted.current) return;
      mergeApplication(application, {
        reviewed_at: result.application.reviewed_at,
      });
      setReviewError((current) =>
        current?.id === application.id ? null : current,
      );
      void load(filterRef.current);
    } catch (cause) {
      if (mounted.current)
        setReviewError({
          id: application.id,
          text:
            cause instanceof Error
              ? cause.message
              : "Gagal menandai pelamar sudah dicek.",
        });
    } finally {
      reviewing.current.delete(application.id);
    }
  }
  useEffect(() => {
    if (initial.applications[0]) void markReviewed(initial.applications[0]);
    // The initial detail is visible immediately; later selections call markReviewed themselves.
  }, []);
  async function select(application: JobApplication) {
    if (stageBusyRef.current) return;
    const version = ++selectionId.current;
    if (
      !(await notes.flush()) ||
      version !== selectionId.current ||
      !mounted.current ||
      stageBusyRef.current
    )
      return;
    selectedRef.current = application;
    setSelected(application);
    setStageError("");
    void markReviewed(application);
  }
  async function changeStage(application: JobApplication, stage: string) {
    if (stageBusyRef.current) return;
    stageBusyRef.current = true;
    setStageBusy(true);
    setStageError("");
    try {
      if (!(await notes.flush())) return;
      const result = await api<{ application: JobApplication }>(
        `/api/recruitment/applications/${application.id}`,
        { method: "PATCH", body: JSON.stringify({ stage }) },
      );
      if (!mounted.current) return;
      mergeApplication(application, { stage: result.application.stage });
      setReject(null);
      await load(filterRef.current);
      router.refresh();
    } catch (cause) {
      setStageError(
        cause instanceof Error
          ? cause.message
          : "Tahap pelamar gagal diperbarui.",
      );
    } finally {
      stageBusyRef.current = false;
      if (mounted.current) setStageBusy(false);
    }
  }
  const total = Object.values(data.stage_counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const setStageFilter = (stage: string) => {
    const next = { ...filterRef.current, stage, page: 1 };
    filterRef.current = next;
    setFilter(next);
  };
  const changePage = (page: number) => {
    const next = { ...filterRef.current, page };
    filterRef.current = next;
    setFilter(next);
  };
  const nextStage =
    selected?.stage === "Ditolak"
      ? STAGES[0]
      : selected && selected.stage !== "Diterima"
        ? STAGES[STAGES.indexOf(selected.stage) + 1]
        : undefined;
  const detail = selected
    ? [
        ["Domisili", selected.city],
        ["Usia", ageLabel(selected.birth_date)],
        ["Pendidikan", selected.education],
        [
          "Pengalaman admin",
          selected.has_admin_experience
            ? `Ya${selected.experience_length ? `, ${selected.experience_length}` : ""}`
            : "Belum",
        ],
        [
          "Pekerjaan terakhir",
          [selected.last_position, selected.last_company]
            .filter(Boolean)
            .join(" · ") || "Belum ada",
          "wide",
        ],
        ["Aplikasi dikuasai", selected.skills.join(", ") || "—", "wide"],
        ["Ekspektasi gaji", money(selected.expected_salary)],
        ["Bisa mulai", selected.start_availability],
        ["Tahu dari", selected.source || "—"],
        ["WhatsApp", `+${whatsappDigits(selected.whatsapp)}`],
      ]
    : [];
  return (
    <div className="rl rl-applicants">
      <div className="rl-header" style={{ alignItems: "center" }}>
        <div className="rl-form-header">
          <Link
            href="/recruitment/lowongan"
            className="rl-btn rl-back"
            aria-label="Kembali ke daftar lowongan"
            onClick={async (event) => {
              if (notes.hasUnsaved()) {
                event.preventDefault();
                if (await notes.flush()) router.push("/recruitment/lowongan");
              }
            }}
          >
            <Icon name="back" size={18} />
          </Link>
          <div className="rl-heading" style={{ gap: 4 }}>
            <div className="rl-row">
              <h1 style={{ fontSize: 26 }}>Pelamar · {job.title}</h1>
              <Badge value={job.status} />
            </div>
            <p className="rl-subtitle" style={{ fontSize: 14 }}>
              {total} pelamar · {data.unreviewed} belum dicek
            </p>
          </div>
        </div>
        <label className="rl-search">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Cari pelamar berdasarkan nama atau domisili"
            placeholder="Cari nama atau domisili"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <div className="rl-tabs" role="group" aria-label="Filter tahap">
        {["", ...STAGES].map((stage) => (
          <button
            type="button"
            key={stage}
            aria-pressed={filter.stage === stage}
            className={`rl-btn rl-tab${filter.stage === stage ? " rl-primary" : ""}`}
            onClick={() => setStageFilter(stage)}
          >
            {stage || "Semua"} · {stage ? data.stage_counts[stage] || 0 : total}
          </button>
        ))}
      </div>
      {error && (
        <ErrorBox message={error} retry={() => void load(filterRef.current)} />
      )}
      {notes.status === "error" && (
        <ErrorBox
          message={`Catatan belum tersimpan: ${notes.error}`}
          retry={() => void notes.flush()}
        />
      )}
      <div className="rl-app-columns">
        <section
          className="rl-table-card"
          aria-label="Daftar pelamar"
          aria-busy={loading}
        >
          {loading && (
            <p
              className="rl-muted"
              role="status"
              style={{ padding: "12px 18px" }}
            >
              Memuat pelamar…
            </p>
          )}
          <div className="rl-table-scroll">
            <table className="rl-table">
              <colgroup>
                <col style={{ width: "32%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">PELAMAR</th>
                  <th scope="col">PENGALAMAN</th>
                  <th scope="col">EKSPEKTASI</th>
                  <th scope="col">MELAMAR</th>
                  <th scope="col">TAHAP</th>
                </tr>
              </thead>
              <tbody>
                {data.applications.map((application) => (
                  <tr
                    key={application.id}
                    data-selected={selected?.id === application.id}
                    onClick={() => {
                      if (!loading) void select(application);
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className="rl-person"
                        disabled={stageBusy || loading}
                        aria-pressed={selected?.id === application.id}
                        aria-label={`Lihat detail ${application.full_name}${!application.reviewed_at ? ", belum dicek" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void select(application);
                        }}
                      >
                        <span className="rl-avatar">
                          {initials(application.full_name)}
                        </span>
                        <span className="rl-person-copy">
                          <span className="rl-person-name">
                            {application.full_name}
                          </span>
                          <span className="rl-muted" style={{ fontSize: 12.5 }}>
                            {application.city}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td>
                      {application.has_admin_experience
                        ? `Ya, ${application.experience_length || "pernah"}`
                        : "Belum"}
                    </td>
                    <td>{money(application.expected_salary)}</td>
                    <td className="rl-muted">
                      <time
                        dateTime={application.created_at}
                        suppressHydrationWarning
                      >
                        {relativeTime(application.created_at)}
                      </time>
                    </td>
                    <td>
                      <Badge value={application.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.applications.length && !loading && !error && (
            <div className="rl-empty">
              <h2>
                {search || filter.stage
                  ? "Tidak ada pelamar yang cocok"
                  : "Belum ada pelamar"}
              </h2>
              <p>
                {search || filter.stage
                  ? "Coba nama, domisili, atau tahap lain."
                  : "Bagikan link lowongan untuk mulai menerima lamaran."}
              </p>
              {(search || filter.stage) && (
                <button
                  type="button"
                  className="rl-btn"
                  onClick={() => {
                    setSearch("");
                    const next = { search: "", stage: "", page: 1 };
                    filterRef.current = next;
                    setFilter(next);
                  }}
                >
                  Reset filter
                </button>
              )}
            </div>
          )}
          <div className="rl-pagination">
            <span>
              Menampilkan{" "}
              {data.applications.length
                ? `${(data.page - 1) * data.page_size + 1}–${(data.page - 1) * data.page_size + data.applications.length}`
                : "0"}{" "}
              dari {data.total}
            </span>
            <div className="rl-row" style={{ gap: 6 }}>
              <button
                className="rl-btn rl-small"
                type="button"
                disabled={loading || filter.page <= 1}
                onClick={() => changePage(filter.page - 1)}
              >
                Sebelumnya
              </button>
              <button
                className="rl-btn rl-small"
                type="button"
                disabled={loading || data.page * data.page_size >= data.total}
                onClick={() => changePage(filter.page + 1)}
              >
                Berikutnya
              </button>
            </div>
          </div>
        </section>
        <section className="rl-card rl-detail" aria-label="Detail pelamar">
          {selected ? (
            <>
              <div className="rl-detail-top">
                <span className="rl-avatar rl-avatar-large">
                  {initials(selected.full_name)}
                </span>
                <div className="rl-stack" style={{ flex: 1, gap: 4 }}>
                  <h2>{selected.full_name}</h2>
                  <span className="rl-muted">
                    Melamar{" "}
                    <time
                      dateTime={selected.created_at}
                      suppressHydrationWarning
                    >
                      {relativeTime(selected.created_at)}
                    </time>
                  </span>
                </div>
                <Badge value={selected.stage} />
              </div>
              {reviewError?.id === selected.id && (
                <ErrorBox
                  message={reviewError.text}
                  retry={() => void markReviewed(selected)}
                />
              )}
              <div className="rl-two">
                <a
                  href={`https://wa.me/${whatsappDigits(selected.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rl-btn rl-green"
                >
                  <Icon name="chat" />
                  Chat WhatsApp
                </a>
                <a
                  href={`/api/recruitment/applications/${selected.id}/cv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rl-btn"
                >
                  <Icon name="file" />
                  Buka CV
                </a>
              </div>
              <dl className="rl-details-grid">
                {detail.map(([label, value, wide]) => (
                  <div key={label} className={wide ? "rl-span-two" : undefined}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div
                className="rl-row"
                style={{ justifyContent: "space-between", fontSize: 12.5 }}
              >
                <span className="rl-muted">{selected.application_number}</span>
                <a
                  href={`mailto:${selected.email}`}
                  style={{ overflowWrap: "anywhere" }}
                >
                  {selected.email}
                </a>
                {/^https?:\/\//i.test(selected.portfolio_url) && (
                  <a
                    href={selected.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rl-btn rl-small"
                  >
                    <Icon name="external" />
                    Portofolio
                  </a>
                )}
              </div>
              <div className="rl-motivation">
                <span
                  className="rl-muted"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  Kenapa cocok di posisi ini
                </span>
                <p>{selected.motivation || "Tidak diisi oleh pelamar."}</p>
              </div>
              <div className="rl-field">
                <label htmlFor="internal-note">
                  Catatan internal (tidak terlihat pelamar)
                </label>
                <textarea
                  id="internal-note"
                  rows={2}
                  maxLength={10000}
                  className="rl-input"
                  placeholder="Contoh: Komunikasi bagus, cek ulang pengalaman Shopee"
                  value={notes.value(selected)}
                  onChange={(event) => notes.edit(selected, event.target.value)}
                  onBlur={() => void notes.flush()}
                  aria-describedby="note-status"
                />
                <span
                  id="note-status"
                  className={notes.status === "error" ? "rl-error" : "rl-muted"}
                  role="status"
                >
                  {notes.status === "saving"
                    ? "Menyimpan catatan…"
                    : notes.status === "dirty"
                      ? "Perubahan belum tersimpan…"
                      : notes.status === "error"
                        ? "Catatan belum tersimpan. Coba lagi sebelum berpindah."
                        : "Catatan tersimpan otomatis"}
                </span>
              </div>
              {stageError && !reject && <ErrorBox message={stageError} />}
              <div className="rl-stage-actions">
                <button
                  type="button"
                  className="rl-btn rl-danger"
                  disabled={
                    stageBusy ||
                    selected.stage === "Ditolak" ||
                    selected.stage === "Diterima"
                  }
                  onClick={() => {
                    setStageError("");
                    setReject(selected);
                  }}
                >
                  Tolak
                </button>
                <button
                  type="button"
                  className="rl-btn rl-primary"
                  disabled={
                    stageBusy || !nextStage || selected.stage === "Diterima"
                  }
                  onClick={() => {
                    if (nextStage) void changeStage(selected, nextStage);
                  }}
                >
                  {stageBusy
                    ? "Memproses…"
                    : selected.stage === "Diterima"
                      ? "Sudah Diterima"
                      : nextLabels[selected.stage] || "Tahap selesai"}
                </button>
              </div>
            </>
          ) : (
            <div className="rl-empty">
              <Icon name="file" size={28} />
              <h2>Pilih pelamar</h2>
              <p>
                Klik pelamar untuk melihat detail, membuka CV, dan melanjutkan
                seleksi.
              </p>
            </div>
          )}
        </section>
      </div>
      {reject && (
        <ConfirmDialog
          title="Tolak lamaran?"
          description={`Lamaran ${reject.full_name} akan dipindahkan ke tahap Ditolak. Kamu dapat memulihkannya nanti.`}
          confirmLabel="Tolak Lamaran"
          danger
          busy={stageBusy}
          error={stageError || (notes.status === "error" ? notes.error : "")}
          onClose={() => setReject(null)}
          onConfirm={() => void changeStage(reject, "Ditolak")}
        />
      )}
    </div>
  );
}
