"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import { DEPARTMENTS, LOCATIONS } from "@/lib/employees/types";
import { invalidateEmployeeDetail } from "@/lib/employees/detail-cache";
import {
  POSITION_CHANGE_TYPES,
  type PositionChangeErrors,
  type PositionChangeInput,
  type PositionChangeType,
  type PositionEmployeeOption,
} from "@/lib/position-history/types";
import {
  POSITION_MAX_LENGTH,
  POSITION_REASON_MAX_LENGTH,
  collectDescendantIds,
  isEligiblePositionEmployee,
  positionChangeDiff,
  validatePositionChange,
} from "@/lib/position-history/rules";
import "@/components/recruitment-live/live.css";

type FormState = {
  employeeId: string;
  changeType: PositionChangeType;
  effectiveDate: string;
  reason: string;
  newPosition: string;
  newDepartment: string;
  newManagerId: string;
  newLocation: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

const formForEmployee = (
  employee: PositionEmployeeOption | null,
  todayIso: string
): FormState => ({
  employeeId: employee?.id ?? "",
  changeType: "Promosi",
  effectiveDate: todayIso,
  reason: "",
  newPosition: employee?.position ?? "",
  newDepartment: employee?.department ?? DEPARTMENTS[0],
  newManagerId: employee?.managerId ?? "",
  newLocation: employee?.location ?? LOCATIONS[0],
});

export function PositionChangeDialog({
  open,
  employees,
  initialEmployeeId,
  todayIso,
  onClose,
  onSaved,
}: {
  open: boolean;
  employees: PositionEmployeeOption[];
  initialEmployeeId?: string | null;
  todayIso: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    formForEmployee(null, todayIso)
  );
  const [errors, setErrors] = useState<PositionChangeErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => employees.find((employee) => employee.id === form.employeeId) ?? null,
    [employees, form.employeeId]
  );

  const employeeChoices = useMemo(() => {
    const eligible = employees.filter((employee) =>
      isEligiblePositionEmployee(employee.status)
    );
    if (
      selected &&
      !eligible.some((employee) => employee.id === selected.id)
    ) {
      return [selected, ...eligible];
    }
    return eligible;
  }, [employees, selected]);

  const descendants = useMemo(
    () =>
      selected
        ? collectDescendantIds(employees, selected.id)
        : new Set<string>(),
    [employees, selected]
  );

  const managerChoices = useMemo(() => {
    if (!selected) return [];
    return employees.filter(
      (employee) =>
        employee.id !== selected.id &&
        (employee.id === selected.managerId ||
          (!descendants.has(employee.id) &&
            isEligiblePositionEmployee(employee.status)))
    );
  }, [employees, selected, descendants]);

  const managerNameById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.fullName])),
    [employees]
  );

  useEffect(() => {
    if (!open) return;

    const initial = initialEmployeeId
      ? employees.find(
          (employee) =>
            employee.id === initialEmployeeId &&
            isEligiblePositionEmployee(employee.status)
        ) ?? null
      : null;

    setForm(formForEmployee(initial, todayIso));
    setErrors({});
    setFormError("");
    setSaving(false);
  }, [open, initialEmployeeId, employees, todayIso]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current) && !current.form) return current;
      const next = { ...current };
      delete next[key];
      delete next.form;
      return next;
    });
    setFormError("");
  };

  const chooseEmployee = (employeeId: string) => {
    const employee =
      employees.find((row) => row.id === employeeId) ?? null;
    setForm(formForEmployee(employee, todayIso));
    setErrors({});
    setFormError("");
  };

  const diff = selected
    ? positionChangeDiff(
        {
          oldPosition: selected.position,
          newPosition: form.newPosition.trim(),
          oldDepartment: selected.department,
          newDepartment: form.newDepartment,
          oldManagerId: selected.managerId,
          newManagerId: form.newManagerId || null,
          oldLocation: selected.location,
          newLocation: form.newLocation,
        },
        (id) => (id ? managerNameById.get(id) ?? id : "—")
      )
    : [];

  const submit = async () => {
    if (!selected) {
      setErrors({ employeeId: "Pilih karyawan" });
      return;
    }

    const input: PositionChangeInput = {
      employeeId: selected.id,
      changeType: form.changeType,
      effectiveDate: form.effectiveDate,
      reason: form.reason.trim(),
      oldPosition: selected.position,
      oldDepartment: selected.department,
      oldManagerId: selected.managerId,
      oldLocation: selected.location,
      newPosition: form.newPosition.trim(),
      newDepartment: form.newDepartment,
      newManagerId: form.newManagerId || null,
      newLocation: form.newLocation,
    };

    const nextErrors = validatePositionChange(input, {
      todayIso,
      joinedAt: selected.joinedAt,
      descendantIds: descendants,
    });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError(
        nextErrors.form ?? "Periksa kembali isian yang ditandai merah."
      );
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/position-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        errors?: PositionChangeErrors;
      } | null;

      if (!response.ok) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error ?? "Gagal mencatat perubahan posisi");
      }

      invalidateEmployeeDetail(selected.id);
      onSaved("Perubahan posisi tercatat");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Gagal mencatat perubahan posisi"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="rl">
      <Modal title="Catat Perubahan" onClose={onClose} busy={saving}>
        {formError && <ErrorBox message={formError} />}

        <div className="rl-fields-grid">
          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="position-employee">Karyawan *</label>
            <select
              id="position-employee"
              className="rl-input"
              value={form.employeeId}
              disabled={saving}
              onChange={(event) => chooseEmployee(event.target.value)}
            >
              <option value="">Pilih karyawan…</option>
              {employeeChoices.map((employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                  disabled={!isEligiblePositionEmployee(employee.status)}
                >
                  {employee.fullName} · {employee.position}
                  {!isEligiblePositionEmployee(employee.status)
                    ? " (Nonaktif)"
                    : ""}
                </option>
              ))}
            </select>
            <FieldError message={errors.employeeId} />
          </div>

          <div className="rl-field">
            <label htmlFor="position-type">Jenis perubahan *</label>
            <select
              id="position-type"
              className="rl-input"
              value={form.changeType}
              disabled={saving}
              onChange={(event) =>
                set("changeType", event.target.value as PositionChangeType)
              }
            >
              {POSITION_CHANGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <FieldError message={errors.changeType} />
          </div>

          <div className="rl-field">
            <label htmlFor="position-effective">Tanggal efektif *</label>
            <input
              id="position-effective"
              type="date"
              className="rl-input"
              value={form.effectiveDate}
              max={todayIso}
              min={selected?.joinedAt ?? undefined}
              disabled={saving}
              onChange={(event) =>
                set("effectiveDate", event.target.value)
              }
            />
            <FieldError message={errors.effectiveDate} />
          </div>

          {selected && (
            <>
              <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="position-new-position">Jabatan *</label>
                <div className="text-[11px] sub mb-1">
                  Sekarang: {selected.position}
                </div>
                <input
                  id="position-new-position"
                  className="rl-input"
                  maxLength={POSITION_MAX_LENGTH}
                  value={form.newPosition}
                  disabled={saving}
                  onChange={(event) =>
                    set("newPosition", event.target.value)
                  }
                />
                <FieldError message={errors.newPosition} />
              </div>

              <div className="rl-field">
                <label htmlFor="position-department">Departemen *</label>
                <div className="text-[11px] sub mb-1">
                  Sekarang: {selected.department}
                </div>
                <select
                  id="position-department"
                  className="rl-input"
                  value={form.newDepartment}
                  disabled={saving}
                  onChange={(event) =>
                    set("newDepartment", event.target.value)
                  }
                >
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.newDepartment} />
              </div>

              <div className="rl-field">
                <label htmlFor="position-location">Lokasi kerja *</label>
                <div className="text-[11px] sub mb-1">
                  Sekarang: {selected.location}
                </div>
                <select
                  id="position-location"
                  className="rl-input"
                  value={form.newLocation}
                  disabled={saving}
                  onChange={(event) =>
                    set("newLocation", event.target.value)
                  }
                >
                  {LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.newLocation} />
              </div>

              <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="position-manager">Atasan langsung</label>
                <div className="text-[11px] sub mb-1">
                  Sekarang:{" "}
                  {selected.managerId
                    ? managerNameById.get(selected.managerId) ??
                      selected.managerId
                    : "—"}
                </div>
                <select
                  id="position-manager"
                  className="rl-input"
                  value={form.newManagerId}
                  disabled={saving}
                  onChange={(event) =>
                    set("newManagerId", event.target.value)
                  }
                >
                  <option value="">— Tanpa atasan —</option>
                  {managerChoices.map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                      disabled={
                        !isEligiblePositionEmployee(employee.status) &&
                        employee.id !== selected.managerId
                      }
                    >
                      {employee.fullName} · {employee.position}
                      {!isEligiblePositionEmployee(employee.status)
                        ? " (Nonaktif)"
                        : ""}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.newManagerId} />
              </div>
            </>
          )}

          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label className="font-semibold">Ringkasan perubahan</label>
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--line)" }}
            >
              {diff.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {diff.map((change) => (
                    <div
                      className="text-[12px] break-words"
                      key={change.field}
                    >
                      <span className="sub">{change.label}:</span>{" "}
                      {change.before} → <b>{change.after}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] sub">
                  Belum ada perubahan. Ubah minimal satu field di atas.
                </div>
              )}
            </div>
            <FieldError message={errors.form} />
          </div>

          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="position-reason">Alasan perubahan *</label>
            <textarea
              id="position-reason"
              className="rl-input"
              rows={3}
              maxLength={POSITION_REASON_MAX_LENGTH}
              placeholder="cth. Promosi berdasarkan evaluasi kinerja semester ini"
              value={form.reason}
              disabled={saving}
              onChange={(event) => set("reason", event.target.value)}
            />
            <div className="text-[10px] sub text-right mt-0.5">
              {form.reason.length}/{POSITION_REASON_MAX_LENGTH}
            </div>
            <FieldError message={errors.reason} />
          </div>
        </div>

        <p className="sub text-[11px] mt-3">
          Perubahan berlaku pada tanggal efektif yang dipilih dan tidak bisa
          dijadwalkan ke masa depan.
        </p>

        <div className="rl-actions">
          <button
            type="button"
            className="rl-btn"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </button>
          <button
            type="button"
            className="rl-btn rl-primary"
            onClick={() => void submit()}
            disabled={saving || !selected}
          >
            {saving ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
