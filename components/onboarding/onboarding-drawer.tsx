"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { formatDateID } from "@/lib/datetime";
import { ini } from "@/lib/data";
import {
  onboardingProgress,
  type OnboardingEntry,
  type OnboardingItem,
} from "@/lib/onboarding/types";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: 12, stroke: "#fff", fill: "none", strokeWidth: 3 }}
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function ChecklistRow({
  item,
  busy,
  onToggle,
  onDateChange,
  onNotesSave,
  onDelete,
}: {
  item: OnboardingItem;
  busy: boolean;
  onToggle: (item: OnboardingItem) => void;
  onDateChange: (item: OnboardingItem, value: string) => void;
  onNotesSave: (item: OnboardingItem, value: string) => void;
  onDelete: (item: OnboardingItem) => void;
}) {
  const [notes, setNotes] = useState(item.notes);

  useEffect(() => {
    setNotes(item.notes);
  }, [item.notes]);

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className={`chk ${item.done ? "on" : ""}`}
          aria-pressed={item.done}
          aria-label={`${item.done ? "Batalkan" : "Tandai selesai"} ${item.label}`}
          disabled={busy}
          onClick={() => onToggle(item)}
        >
          {item.done ? <CheckIcon /> : null}
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={`text-[13px] font-semibold ${
              item.done ? "sub line-through" : ""
            }`}
          >
            {item.label}
          </div>

          {item.done && (
            <div className="flex items-center gap-2 mt-2">
              <label
                className="text-[11px] sub"
                htmlFor={`completed-${item.id}`}
              >
                Tanggal selesai
              </label>
              <input
                id={`completed-${item.id}`}
                type="date"
                className="inp !h-8 !py-0 !text-[12px] max-w-[170px]"
                value={item.completedOn ?? ""}
                disabled={busy}
                onChange={(event) => {
                  if (event.target.value)
                    onDateChange(item, event.target.value);
                }}
              />
            </div>
          )}

          <textarea
            className="inp mt-2 !text-[12px]"
            rows={2}
            maxLength={500}
            placeholder="Catatan (opsional)"
            value={notes}
            disabled={busy}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if (notes !== item.notes) onNotesSave(item, notes);
            }}
          />
          <div className="text-[10px] sub text-right mt-0.5">
            {notes.length}/500
          </div>
        </div>

        <button
          type="button"
          className="btn btn-g !py-1 !px-2 !text-[11px]"
          style={{ color: "var(--bad)" }}
          disabled={busy}
          onClick={() => onDelete(item)}
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

export function OnboardingDrawer({
  entry,
  onClose,
  onUpdated,
  onToast,
}: {
  entry: OnboardingEntry | null;
  onClose: () => void;
  onUpdated: (entry: OnboardingEntry) => void;
  onToast: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setAddLabel("");
    setDeleteTarget(null);
  }, [entry?.id]);

  const progress = entry ? onboardingProgress(entry) : null;

  async function patchItem(
    item: OnboardingItem,
    body: Record<string, unknown>,
    successMessage?: string,
  ) {
    if (!entry || busyId) return;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/onboarding/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as {
        item?: OnboardingItem;
        error?: string;
      } | null;
      if (!response.ok || !data?.item)
        throw new Error(data?.error ?? "Gagal menyimpan item onboarding");

      onUpdated({
        ...entry,
        items: entry.items.map((row) =>
          row.id === data.item!.id ? data.item! : row,
        ),
      });
      if (successMessage) onToast(successMessage);
    } catch (error) {
      onToast(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan item onboarding",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function addItem() {
    if (!entry || adding) return;
    const label = addLabel.trim();
    if (!label) {
      onToast("Nama item wajib diisi");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`/api/onboarding/${entry.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = (await response.json().catch(() => null)) as {
        item?: OnboardingItem;
        error?: string;
      } | null;
      if (!response.ok || !data?.item)
        throw new Error(data?.error ?? "Gagal menambah item");

      onUpdated({ ...entry, items: [...entry.items, data.item] });
      setAddLabel("");
      onToast("Item onboarding ditambahkan");
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Gagal menambah item",
      );
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete() {
    if (!entry || !deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(
        `/api/onboarding/items/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Gagal menghapus item");

      onUpdated({
        ...entry,
        items: entry.items.filter((item) => item.id !== deleteTarget.id),
      });
      setDeleteTarget(null);
      onToast("Item onboarding dihapus");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menghapus item";
      setDeleteError(message);
      onToast(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`drawer ${entry ? "show" : ""}`}>
      {entry && progress && (
        <>
          <div
            className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="font-bold">Checklist Onboarding</span>
            <button
              className="btn btn-g !px-3"
              onClick={onClose}
              aria-label="Tutup checklist onboarding"
            >
              ✕
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="av" style={{ width: 56, height: 56, fontSize: 18 }}>
                {ini(entry.employeeName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[19px] leading-tight">
                  {entry.employeeName}
                </div>
                <div className="sub text-[13px]">
                  {entry.employeeId} · {entry.position}
                </div>
                <div className="sub text-[12px]">
                  {entry.department} · Bergabung {formatDateID(entry.joinedAt)}
                </div>
              </div>
              <span
                className={`tag ml-auto ${
                  progress.status === "Selesai" ? "t-ok" : "t-warn"
                }`}
              >
                {progress.status}
              </span>
            </div>

            <div className="flex justify-between text-[12px] mb-1">
              <span className="sub">
                {progress.done} dari {progress.total} selesai
              </span>
              <b>{progress.percent}%</b>
            </div>
            <div className="bar mb-6">
              <i style={{ width: `${progress.percent}%` }} />
            </div>

            <div className="flex flex-col gap-3">
              {entry.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onToggle={(row) =>
                    void patchItem(
                      row,
                      { done: !row.done },
                      !row.done
                        ? "Item ditandai selesai"
                        : "Centang item dibatalkan",
                    )
                  }
                  onDateChange={(row, value) =>
                    void patchItem(
                      row,
                      { completedOn: value },
                      "Tanggal selesai diperbarui",
                    )
                  }
                  onNotesSave={(row, value) =>
                    void patchItem(row, { notes: value })
                  }
                  onDelete={(row) => {
                    setDeleteError("");
                    setDeleteTarget(row);
                  }}
                />
              ))}
              {entry.items.length === 0 && (
                <div className="sub text-[13px]">
                  Belum ada item. Tambahkan item baru di bawah.
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="lbl" htmlFor="onboarding-add-item">
                Tambah item
              </label>
              <div className="flex gap-2">
                <input
                  id="onboarding-add-item"
                  className="inp"
                  maxLength={200}
                  placeholder="cth. Serah terima laptop"
                  value={addLabel}
                  disabled={adding}
                  onChange={(event) => setAddLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addItem();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-p"
                  onClick={() => void addItem()}
                  disabled={adding || !addLabel.trim()}
                >
                  {adding ? "Menambah…" : "Tambah"}
                </button>
              </div>
              <p className="sub text-[11px] mt-1">
                Item hanya berlaku untuk karyawan ini; template standar tidak
                berubah.
              </p>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <div className="rl">
          <ConfirmDialog
            title="Hapus item?"
            description={`Item "${deleteTarget.label}" akan dihapus dari checklist karyawan ini. Tindakan ini tidak bisa dibatalkan.`}
            confirmLabel="Ya, hapus"
            danger
            busy={deleting}
            error={deleteError}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => void confirmDelete()}
          />
        </div>
      )}
    </div>
  );
}
