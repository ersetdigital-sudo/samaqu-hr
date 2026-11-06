"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { ROLE_LABELS } from "@/lib/session";
import type { Role } from "@/lib/navigation";
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
  type EmployeeOption,
  type RoleOption,
  type UserAccessEntry,
  type UserAccount,
} from "@/lib/users/types";

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", { dateStyle: "medium" })
    : "—";

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const statusTone = (status: AccountStatus) =>
  status === "Aktif" ? "t-ok" : status === "Diundang" ? "t-warn" : "t-bad";

type FormState = {
  mode: "create" | "edit";
  id: string | null;
  fullName: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  employeeId: string;
};

const blankForm = (): FormState => ({
  mode: "create",
  id: null,
  fullName: "",
  email: "",
  role: "employee",
  accountStatus: "Diundang",
  employeeId: "",
});

export function UsersView({
  initialUsers,
  roles,
  employees,
  currentUserId,
}: {
  initialUsers: UserAccount[];
  roles: RoleOption[];
  employees: EmployeeOption[];
  currentUserId: string;
}) {
  const { toast } = useRecruitment();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [history, setHistory] = useState<{
    user: UserAccount;
    entries: UserAccessEntry[];
  } | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      `${user.fullName} ${user.email} ${user.role ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [users, query]);

  const refresh = async () => {
    const response = await fetch("/api/users", { cache: "no-store" });
    if (!response.ok) throw new Error("Gagal memuat pengguna");
    const data = (await response.json()) as { users: UserAccount[] };
    setUsers(data.users);
  };

  const openCreate = () => {
    setForm(blankForm());
    setErrors({});
    setFormError(null);
  };

  const openEdit = (user: UserAccount) => {
    setForm({
      mode: "edit",
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role ?? "employee",
      accountStatus: user.accountStatus,
      employeeId: user.employeeId ?? "",
    });
    setErrors({});
    setFormError(null);
  };

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);

    try {
      const response = await fetch(
        form.mode === "create" ? "/api/users" : `/api/users/${form.id}`,
        {
          method: form.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            email: form.email,
            role: form.role,
            accountStatus: form.accountStatus,
            employeeId: form.employeeId || null,
          }),
        }
      );

      const data = (await response.json()) as {
        error?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.errors) setErrors(data.errors);
        throw new Error(data.error ?? "Gagal menyimpan pengguna");
      }

      await refresh();
      setForm(null);
      toast(
        form.mode === "create"
          ? "Undangan akun dikirim ke email pengguna"
          : "Data pengguna diperbarui"
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Gagal menyimpan pengguna"
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    user: UserAccount,
    action: "invite" | "reset"
  ) => {
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}/${action}`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Aksi gagal");
      toast(
        action === "invite"
          ? `Undangan dikirim ulang ke ${user.email}`
          : `Tautan reset password dikirim ke ${user.email}`
      );
      await refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Aksi gagal");
    } finally {
      setBusyId(null);
    }
  };

  const showHistory = async (user: UserAccount) => {
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}/history`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        history?: UserAccessEntry[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Gagal memuat riwayat");
      setHistory({ user, entries: data.history ?? [] });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal memuat riwayat");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHead
        title="Pengguna & Peran"
        subtitle="Akun internal HRIS. Akses diberikan melalui role dari database, bukan pendaftaran mandiri."
      >
        <button className="btn btn-g" onClick={() => void refresh()}>
          Muat ulang
        </button>
        <button className="btn btn-p" onClick={openCreate}>
          <Icon name="plus" /> Tambah Pengguna
        </button>
      </PageHead>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full md:w-80">
          <input
            className="inp pl-9"
            placeholder="Cari nama, email, atau role…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Icon
            name="search"
            className="absolute left-3 top-[11px]"
            style={{ color: "#A59B97", width: 16 }}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Terakhir Login</th>
              <th>Dibuat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td>
                  <b className="whitespace-nowrap">{user.fullName}</b>
                  {user.employeeId && (
                    <div className="text-[11px] sub whitespace-nowrap">
                      {user.employeeId}
                      {user.employeeName ? ` · ${user.employeeName}` : ""}
                    </div>
                  )}
                </td>
                <td className="sub whitespace-nowrap">{user.email}</td>
                <td className="sub whitespace-nowrap">
                  {user.role ? ROLE_LABELS[user.role] : "Tanpa role"}
                </td>
                <td>
                  <span className={`tag ${statusTone(user.accountStatus)}`}>
                    {user.accountStatus}
                  </span>
                </td>
                <td className="sub whitespace-nowrap">
                  {formatDateTime(user.lastSignInAt)}
                </td>
                <td className="sub whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="btn btn-g !py-1 !px-2.5 !text-[11px]"
                      onClick={() => openEdit(user)}
                    >
                      Kelola
                    </button>
                    {user.accountStatus === "Diundang" && (
                      <button
                        className="btn btn-g !py-1 !px-2.5 !text-[11px]"
                        onClick={() => void runAction(user, "invite")}
                        disabled={busyId === user.id}
                      >
                        Undang
                      </button>
                    )}
                    <button
                      className="btn btn-g !py-1 !px-2.5 !text-[11px]"
                      onClick={() => void runAction(user, "reset")}
                      disabled={busyId === user.id}
                    >
                      Reset
                    </button>
                    <button
                      className="btn btn-g !py-1 !px-2.5 !text-[11px]"
                      onClick={() => void showHistory(user)}
                      disabled={busyId === user.id}
                    >
                      Riwayat
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center sub py-10">
                  Belum ada pengguna yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div
          className="modal show"
          onClick={(event) => {
            if (event.target === event.currentTarget) setForm(null);
          }}
        >
          <div className="card w-full max-w-[620px] shadow-xl">
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: "var(--line)" }}
            >
              <div>
                <div className="font-bold text-[17px]">
                  {form.mode === "create" ? "Tambah Pengguna" : "Kelola Pengguna"}
                </div>
                <div className="sub text-[13px]">
                  {form.mode === "create"
                    ? "Undangan dikirim via email; pengguna membuat kata sandi sendiri."
                    : "Role dan status akun berlaku saat pengguna login berikutnya."}
                </div>
              </div>
              <button className="btn btn-g !px-3" onClick={() => setForm(null)}>
                ✕
              </button>
            </div>

            <div className="p-6">
              {formError && (
                <div
                  className="mb-4 p-3 rounded-xl text-[12px]"
                  style={{ background: "var(--badb)", color: "var(--bad)" }}
                >
                  {formError}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="lbl">Nama lengkap *</label>
                  <input
                    className="inp"
                    value={form.fullName}
                    onChange={(event) =>
                      setForm({ ...form, fullName: event.target.value })
                    }
                  />
                  {errors.fullName && (
                    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                      {errors.fullName}
                    </div>
                  )}
                </div>

                <div className={form.mode === "create" ? "" : "md:col-span-2"}>
                  <label className="lbl">Email *</label>
                  <input
                    className="inp"
                    type="email"
                    value={form.email}
                    disabled={form.mode === "edit"}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                  {errors.email && (
                    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                      {errors.email}
                    </div>
                  )}
                  {form.mode === "edit" && (
                    <div className="text-[11px] sub mt-1">
                      Email tidak diubah di sini; gunakan undangan/reset.
                    </div>
                  )}
                </div>

                <div>
                  <label className="lbl">Role *</label>
                  <select
                    className="inp"
                    value={form.role}
                    disabled={form.id === currentUserId}
                    onChange={(event) =>
                      setForm({ ...form, role: event.target.value as Role })
                    }
                  >
                    {roles.map((role) => (
                      <option key={role.name} value={role.name}>
                        {ROLE_LABELS[role.name]}
                      </option>
                    ))}
                  </select>
                  {form.id === currentUserId && (
                    <div className="text-[11px] sub mt-1">
                      Role akun sendiri tidak dapat diubah.
                    </div>
                  )}
                </div>

                <div>
                  <label className="lbl">Status akun</label>
                  <select
                    className="inp"
                    value={form.accountStatus}
                    disabled={form.id === currentUserId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        accountStatus: event.target.value as AccountStatus,
                      })
                    }
                  >
                    {ACCOUNT_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  {form.id === currentUserId && (
                    <div className="text-[11px] sub mt-1">
                      Status akun sendiri tidak dapat diubah.
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="lbl">Tautkan ke karyawan (opsional)</label>
                  <select
                    className="inp"
                    value={form.employeeId}
                    onChange={(event) =>
                      setForm({ ...form, employeeId: event.target.value })
                    }
                  >
                    <option value="">— Tidak ditautkan —</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.id} · {employee.fullName} · {employee.position}
                      </option>
                    ))}
                  </select>
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
              <button className="btn btn-g" onClick={() => setForm(null)} disabled={saving}>
                Batal
              </button>
              <button className="btn btn-p" onClick={() => void submit()} disabled={saving}>
                {saving ? "Menyimpan…" : form.mode === "create" ? "Kirim Undangan" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {history && (
        <div
          className="modal show"
          onClick={(event) => {
            if (event.target === event.currentTarget) setHistory(null);
          }}
        >
          <div className="card w-full max-w-[560px] shadow-xl">
            <div
              className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: "var(--line)" }}
            >
              <div>
                <div className="font-bold text-[17px]">Riwayat Akses</div>
                <div className="sub text-[13px]">{history.user.fullName}</div>
              </div>
              <button className="btn btn-g !px-3" onClick={() => setHistory(null)}>
                ✕
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3 max-h-[420px] overflow-auto">
              {history.entries.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: "var(--pink)" }}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{entry.action}</div>
                    <div className="text-[11px] sub">
                      {formatDateTime(entry.changedAt)}
                      {entry.fromValue || entry.toValue
                        ? ` · ${entry.fromValue ?? "—"} → ${entry.toValue ?? "—"}`
                        : ""}
                    </div>
                    {entry.reason && (
                      <div className="text-[11px] sub">{entry.reason}</div>
                    )}
                  </div>
                </div>
              ))}
              {history.entries.length === 0 && (
                <div className="sub text-[13px]">Belum ada riwayat.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
