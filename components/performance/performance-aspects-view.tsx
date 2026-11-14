"use client";

import { useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import type { PerformanceAspect } from "@/lib/performance/types";

export function PerformanceAspectsView({
  initialAspects,
}: {
  initialAspects: PerformanceAspect[];
}) {
  const { toast } = useRecruitment();
  const [aspects, setAspects] = useState(initialAspects);
  const [editing, setEditing] = useState<PerformanceAspect | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeCount = aspects.filter((aspect) => aspect.isActive).length;

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSortOrder(aspects.length + 1);
    setIsActive(true);
    setError("");
    setOpen(true);
  };

  const openEdit = (aspect: PerformanceAspect) => {
    setEditing(aspect);
    setName(aspect.name);
    setDescription(aspect.description);
    setSortOrder(aspect.sortOrder);
    setIsActive(aspect.isActive);
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Nama aspek wajib diisi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        editing
          ? `/api/performance/aspects/${editing.id}`
          : "/api/performance/aspects",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            sortOrder,
            isActive,
          }),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        aspects?: PerformanceAspect[];
        error?: string;
      } | null;
      if (!response.ok || !body?.aspects) {
        throw new Error(body?.error ?? "Gagal menyimpan aspek");
      }
      setAspects(body.aspects);
      setOpen(false);
      toast(editing ? "Aspek diperbarui" : "Aspek ditambahkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan aspek");
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<PerformanceAspect>[] = [
    {
      key: "order",
      label: "Urutan",
      width: "10%",
      render: (aspect) => <span className="text-[13px]">{aspect.sortOrder}</span>,
    },
    {
      key: "aspect",
      label: "Aspek",
      width: "44%",
      render: (aspect) => (
        <TwoLineCell primary={aspect.name} secondary={aspect.description} />
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (aspect) => (
        <span className={`tag ${aspect.isActive ? "t-ok" : "t-mute"}`}>
          {aspect.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Aksi",
      width: "14%",
      render: (aspect) => (
        <button
          type="button"
          className="btn btn-g !py-1 !px-2 !text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            openEdit(aspect);
          }}
        >
          Ubah
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="Pengaturan Aspek"
        subtitle="Kelola aspek penilaian. Aspek yang pernah dipakai tidak dapat dihapus."
      >
        <button type="button" className="btn btn-p" onClick={openCreate}>
          Tambah Aspek
        </button>
      </PageHead>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-[12px]">
        <span className="tag t-info">{activeCount} aspek aktif</span>
        <span className="sub">
          Minimal 3 aspek aktif. Perubahan hanya berlaku untuk periode yang
          dibuka setelahnya; periode berjalan memakai snapshot.
        </span>
      </div>

      <div className="card p-5 sm:p-6">
        <DataTable
          ariaLabel="Daftar aspek penilaian"
          columns={columns}
          rows={aspects}
          rowKey={(aspect) => aspect.id}
          rowLabel={(aspect) => `Ubah aspek ${aspect.name}`}
          onRowActivate={openEdit}
          rowAction={{
            ariaLabel: (aspect) => `Ubah aspek ${aspect.name}`,
            label: "Ubah aspek",
          }}
          empty="Belum ada aspek penilaian."
          minWidth={780}
        />
      </div>

      <FormDrawer
        open={open}
        title={editing ? "Ubah Aspek" : "Tambah Aspek"}
        description="Nama dan deskripsi akan disalin sebagai snapshot saat periode dibuka."
        size="md"
        busy={busy}
        onRequestClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-g"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-p"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      >
        {error && (
          <div className="tag t-bad w-full justify-center mb-4">{error}</div>
        )}
        <label className="block mb-3">
          <span className="lbl">Nama aspek *</span>
          <input
            className="inp"
            value={name}
            maxLength={120}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block mb-3">
          <span className="lbl">Deskripsi</span>
          <textarea
            className="inp"
            rows={3}
            maxLength={500}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="lbl">Urutan</span>
            <input
              type="number"
              className="inp !w-32"
              min={0}
              value={sortOrder}
              disabled={busy}
              onChange={(event) => setSortOrder(Number(event.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] pb-2">
            <input
              type="checkbox"
              checked={isActive}
              disabled={busy}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Aspek aktif
          </label>
        </div>
        {editing?.isActive && !isActive && activeCount <= 3 && (
          <div className="text-[11px] mt-3" style={{ color: "var(--bad)" }}>
            Nonaktifkan ditolak bila aspek aktif tersisa kurang dari 3.
          </div>
        )}
      </FormDrawer>
    </>
  );
}
