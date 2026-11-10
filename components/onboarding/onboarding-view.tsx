"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import {
  onboardingProgress,
  type OnboardingBoard,
  type OnboardingEntry,
} from "@/lib/onboarding/types";
import { OnboardingDrawer } from "./onboarding-drawer";
import "@/components/recruitment-live/live.css";

const STATUS_FILTERS = ["Semua", "Berjalan", "Selesai"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function OnboardingView({
  initial,
  initialError,
}: {
  initial: OnboardingBoard | null;
  initialError?: string;
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [entries, setEntries] = useState(initial?.entries ?? []);
  const [available, setAvailable] = useState(initial?.available ?? []);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setEntries(initial?.entries ?? []);
    setAvailable(initial?.available ?? []);
  }, [initial]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (
        statusFilter !== "Semua" &&
        onboardingProgress(entry).status !== statusFilter
      )
        return false;
      if (!term) return true;
      return `${entry.employeeName} ${entry.position} ${entry.department}`
        .toLowerCase()
        .includes(term);
    });
  }, [entries, query, statusFilter]);

  function replaceEntry(updated: OnboardingEntry) {
    setEntries((current) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  }

  function openStart() {
    setEmployeeId("");
    setStartError("");
    setStartOpen(true);
  }

  async function startOnboarding() {
    if (!employeeId) {
      setStartError("Pilih karyawan yang akan di-onboarding.");
      return;
    }

    setStarting(true);
    setStartError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const data = (await response.json().catch(() => null)) as {
        entry?: OnboardingEntry;
        error?: string;
      } | null;
      if (!response.ok || !data?.entry)
        throw new Error(data?.error ?? "Onboarding gagal dimulai");

      const entry = data.entry;
      setEntries((current) => [entry, ...current]);
      setAvailable((current) =>
        current.filter((employee) => employee.id !== entry.employeeId),
      );
      setSelectedId(entry.id);
      setStartOpen(false);
      toast(`Onboarding ${entry.employeeName} dimulai`);
    } catch (error) {
      setStartError(
        error instanceof Error ? error.message : "Onboarding gagal dimulai",
      );
    } finally {
      setStarting(false);
    }
  }

  const columns: DataTableColumn<OnboardingEntry>[] = [
    {
      key: "karyawan",
      label: "Karyawan",
      width: "34%",
      render: (entry) => (
        <TwoLineCell
          primary={entry.employeeName}
          secondary={`${entry.position} · ${entry.department}`}
        />
      ),
    },
    {
      key: "bergabung",
      label: "Bergabung",
      width: "16%",
      render: (entry) => (
        <span className="sub text-[13px]">{formatDateID(entry.joinedAt)}</span>
      ),
    },
    {
      key: "progres",
      label: "Progres",
      width: "28%",
      render: (entry) => {
        const progress = onboardingProgress(entry);
        return (
          <div>
            <div className="text-[12px] sub">
              {progress.done} dari {progress.total} selesai
            </div>
            <div className="bar mt-1">
              <i style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      width: "22%",
      render: (entry) => {
        const status = onboardingProgress(entry).status;
        return (
          <span className={`tag ${status === "Selesai" ? "t-ok" : "t-warn"}`}>
            {status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="rl">
      <PageHead
        title="Onboarding"
        subtitle="Checklist orientasi karyawan baru. Hanya HR Manager dan Admin yang dapat mengakses."
      >
        <span className="sub text-[13px]">{entries.length} onboarding</span>
        {available.length > 0 && (
          <button className="btn btn-p" onClick={openStart}>
            <Icon name="plus" style={{ width: 16 }} />
            Mulai Onboarding
          </button>
        )}
      </PageHead>

      {!initial ? (
        <ErrorBox
          message={
            initialError ??
            "Data onboarding belum dapat dimuat. Silakan coba lagi."
          }
          retry={() => router.refresh()}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full md:w-80">
              <input
                className="inp inp-search"
                placeholder="Cari nama, jabatan, atau departemen…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Icon name="search" className="search-icon" />
            </div>
            <select
              className="inp !w-auto"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              aria-label="Filter status onboarding"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="card">
            <DataTable
              ariaLabel="Daftar onboarding karyawan"
              columns={columns}
              rows={filtered}
              rowKey={(entry) => entry.id}
              rowLabel={(entry) => `Buka checklist ${entry.employeeName}`}
              onRowActivate={(entry) => setSelectedId(entry.id)}
              rowAction={{
                ariaLabel: (entry) => `Buka checklist ${entry.employeeName}`,
                label: "Buka checklist",
                onClick: (entry) => setSelectedId(entry.id),
              }}
              empty={
                entries.length
                  ? "Tidak ada onboarding yang cocok dengan filter."
                  : "Belum ada onboarding. Mulai onboarding untuk karyawan baru."
              }
            />
          </div>
        </>
      )}

      <OnboardingDrawer
        entry={selected}
        onClose={() => {
          setSelectedId(null);
          router.refresh();
        }}
        onUpdated={replaceEntry}
        onToast={toast}
      />

      {startOpen && (
        <Modal
          title="Mulai Onboarding"
          onClose={() => setStartOpen(false)}
          busy={starting}
        >
          {startError && <ErrorBox message={startError} />}
          <div className="rl-field">
            <label htmlFor="onboarding-employee">Karyawan *</label>
            <select
              id="onboarding-employee"
              className="rl-input"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">— Pilih karyawan —</option>
              {available.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {`${employee.fullName} · ${employee.position} (${employee.status})`}
                </option>
              ))}
            </select>
          </div>
          <p className="sub text-[12px] mt-3">
            Checklist standar akan dibuat otomatis dan bisa disesuaikan per
            karyawan.
          </p>
          <div className="rl-actions">
            <button
              type="button"
              className="rl-btn"
              onClick={() => setStartOpen(false)}
              disabled={starting}
            >
              Batal
            </button>
            <button
              type="button"
              className="rl-btn rl-primary"
              onClick={() => void startOnboarding()}
              disabled={starting || !employeeId}
            >
              {starting ? "Memulai…" : "Mulai Onboarding"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
