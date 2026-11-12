"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { OrganizationDepartments } from "@/components/organization/organization-departments";
import { OrganizationDrawer } from "@/components/organization/organization-drawer";
import { OrganizationTree } from "@/components/organization/organization-tree";
import {
  collectAncestorIdsForMatches,
  collectMatchIds,
  collectViewerAncestors,
  normalizeSearchTerm,
} from "@/lib/organization/search";
import {
  buildOrganizationModel,
  collectAllNodeIds,
  findNodeById,
} from "@/lib/organization/tree";
import type { OrganizationEmployee } from "@/lib/organization/types";

type OrganizationViewMode = "chart" | "departments";

type OrganizationResponse = {
  employees?: OrganizationEmployee[];
  error?: string;
};

export function OrganizationView({
  initialEmployees,
  viewerEmployeeId,
  canOpenDirectory,
  showWarnings,
}: {
  initialEmployees: OrganizationEmployee[];
  viewerEmployeeId: string | null;
  canOpenDirectory: boolean;
  showWarnings: boolean;
}) {
  const { toast } = useRecruitment();
  const [employees, setEmployees] = useState(initialEmployees);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [view, setView] = useState<OrganizationViewMode>("chart");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!viewerEmployeeId) return new Set();
    const initialForest = buildOrganizationModel(
      initialEmployees,
      false
    ).forest;
    return collectViewerAncestors(initialForest, viewerEmployeeId);
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const model = useMemo(
    () => buildOrganizationModel(employees, includeInactive),
    [employees, includeInactive]
  );

  const matchIds = useMemo(
    () => collectMatchIds(model.forest, query),
    [model.forest, query]
  );
  const searchAncestors = useMemo(
    () => collectAncestorIdsForMatches(model.forest, matchIds),
    [model.forest, matchIds]
  );
  const expandedForRender = useMemo(() => {
    const next = new Set(expanded);
    searchAncestors.forEach((id) => next.add(id));
    return next;
  }, [expanded, searchAncestors]);

  useEffect(() => {
    if (!viewerEmployeeId) return;
    const path = collectViewerAncestors(model.forest, viewerEmployeeId);
    if (path.size === 0) return;

    setExpanded((current) => {
      const next = new Set(current);
      let changed = false;
      path.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [viewerEmployeeId, model.forest]);

  const selectedNode = useMemo(
    () => findNodeById(model.forest, selectedId),
    [model.forest, selectedId]
  );

  useEffect(() => {
    if (selectedId && !selectedNode) setSelectedId(null);
  }, [selectedId, selectedNode]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/organization", { cache: "no-store" });
      const body = (await response
        .json()
        .catch(() => null)) as OrganizationResponse | null;

      if (!response.ok || !body?.employees) {
        throw new Error(body?.error ?? "Gagal memuat struktur organisasi");
      }

      setEmployees(body.employees);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Gagal memuat struktur organisasi"
      );
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const toggleNode = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(collectAllNodeIds(model.forest));
  const collapseAll = () => setExpanded(new Set());

  const term = query.trim();
  const hasSearch = normalizeSearchTerm(query) !== "";
  const noMatches = hasSearch && matchIds.size === 0;

  const summary = [
    {
      label: "Karyawan di Bagan",
      value: model.summary.total,
      hint: includeInactive
        ? "termasuk karyawan nonaktif"
        : "nonaktif disembunyikan",
    },
    {
      label: "Departemen",
      value: model.summary.departments,
      hint: "dari karyawan yang tampil",
    },
    {
      label: "Tingkat Terdalam",
      value: model.summary.deepestLevel,
      hint: "level atasan-bawahan",
    },
  ];

  return (
    <>
      <PageHead
        title="Struktur Organisasi"
        subtitle="Bagan atasan-bawahan dan sebaran karyawan per departemen, mengikuti data atasan langsung di Direktori."
      >
        <button
          className="btn btn-g"
          onClick={() => void refresh()}
          disabled={busy}
        >
          {busy ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {summary.map((card) => (
          <div className="card p-5" key={card.label}>
            <div className="text-[12px] sub font-semibold">{card.label}</div>
            <div className="text-[28px] font-bold tracking-tight mt-1">
              {card.value}
            </div>
            <div className="text-[12px] sub mt-1">{card.hint}</div>
          </div>
        ))}
      </div>

      {employees.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="font-semibold text-[14px]">
            Belum ada data struktur organisasi
          </div>
          <div className="sub text-[13px] mt-1">
            Tambahkan karyawan dan atasan langsungnya lewat Direktori Karyawan.
          </div>
        </div>
      ) : (
        <>
          <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full md:w-72">
              <input
                className="inp inp-search"
                placeholder="Cari nama atau jabatan…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Cari karyawan atau jabatan"
              />
              <Icon name="search" className="search-icon" />
            </div>

            <label className="flex items-center gap-2 text-[12px] sub cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                style={{ accentColor: "var(--pink)" }}
              />
              Tampilkan nonaktif
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`btn ${
                  view === "chart" ? "btn-p" : "btn-g"
                } !py-1.5 !px-3`}
                aria-pressed={view === "chart"}
                onClick={() => setView("chart")}
              >
                Bagan
              </button>
              <button
                type="button"
                className={`btn ${
                  view === "departments" ? "btn-p" : "btn-g"
                } !py-1.5 !px-3`}
                aria-pressed={view === "departments"}
                onClick={() => setView("departments")}
              >
                Departemen
              </button>
            </div>

            {view === "chart" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-g !py-1.5 !px-3"
                  onClick={expandAll}
                >
                  Buka semua
                </button>
                <button
                  type="button"
                  className="btn btn-g !py-1.5 !px-3"
                  onClick={collapseAll}
                >
                  Tutup semua
                </button>
              </div>
            )}
          </div>

          {model.summary.total === 0 ? (
            <div className="card p-8 text-center">
              <div className="font-semibold text-[14px]">
                Tidak ada karyawan yang tampil
              </div>
              <div className="sub text-[13px] mt-1">
                Nyalakan &quot;Tampilkan nonaktif&quot; untuk melihat karyawan
                nonaktif.
              </div>
            </div>
          ) : noMatches ? (
            <div className="card p-8 text-center">
              <div className="font-semibold text-[14px]">
                Tidak ada karyawan yang cocok
              </div>
              <div className="sub text-[13px] mt-1">
                Coba kata kunci nama atau jabatan lain.
              </div>
              <button
                type="button"
                className="btn btn-g mt-4"
                onClick={() => setQuery("")}
              >
                Hapus pencarian
              </button>
            </div>
          ) : view === "chart" ? (
            <OrganizationTree
              forest={model.forest}
              expanded={expandedForRender}
              term={term}
              viewerEmployeeId={viewerEmployeeId}
              showWarnings={showWarnings}
              onToggle={toggleNode}
              onOpen={setSelectedId}
            />
          ) : (
            <OrganizationDepartments
              groups={model.departmentGroups}
              term={term}
              viewerEmployeeId={viewerEmployeeId}
              onOpen={setSelectedId}
            />
          )}
        </>
      )}

      <OrganizationDrawer
        node={selectedNode}
        canOpenDirectory={canOpenDirectory}
        showWarnings={showWarnings}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
