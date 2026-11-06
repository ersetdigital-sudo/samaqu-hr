/**
 * Manajemen akun pengguna.
 *
 * Satu-satunya tempat pemakaian service role di sisi aplikasi, karena operasi
 * ini butuh Supabase Admin API (undang pengguna, ban/unban). Seluruh pemanggil
 * wajib lolos guard admin di route API.
 *
 * Role selalu dibaca dari tabel `roles`; input role dari klien hanya dipetakan
 * ke nama role yang terdaftar, tidak pernah dipercaya sebagai otoritas.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import type { Role } from "@/lib/navigation";
import {
  MANAGEABLE_ROLES,
  type AccountStatus,
  type EmployeeOption,
  type NewUserInput,
  type RoleOption,
  type UserAccessEntry,
  type UserAccount,
  type UserUpdateInput,
} from "@/lib/users/types";

export class UserDataError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserDataError";
    this.status = status;
  }
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  account_status: AccountStatus;
  employee_id: string | null;
  last_sign_in_at: string | null;
  created_at: string;
};

const mapAuthError = (message: string): string => {
  const text = message.toLowerCase();

  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "Email ini sudah terdaftar";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Terlalu banyak permintaan email. Coba lagi beberapa saat.";
  }
  if (text.includes("email")) {
    return "Email tidak dapat dikirim. Periksa konfigurasi email server.";
  }
  return "Gagal membuat akun pengguna";
};

const baseUrl = (origin: string) => origin.replace(/\/$/, "");

export async function listUsers(): Promise<UserAccount[]> {
  const supabase = getServiceSupabase();

  const [profileResult, roleResult, employeeResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(
        "id, full_name, email, account_status, employee_id, last_sign_in_at, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, roles(name)"),
    supabase.from("employees").select("id, full_name"),
  ]);

  if (profileResult.error) throw new UserDataError("Gagal memuat pengguna", 500);

  const roleByUser = new Map<string, Role>();
  ((roleResult.data ?? []) as unknown as {
    user_id: string;
    roles: { name: string } | { name: string }[] | null;
  }[]).forEach((row) => {
    const names = !row.roles
      ? []
      : Array.isArray(row.roles)
        ? row.roles.map((item) => item.name)
        : [row.roles.name];

    const match = names.find((name) => MANAGEABLE_ROLES.includes(name as Role));
    if (match) roleByUser.set(row.user_id, match as Role);
  });

  const nameByEmployee = new Map(
    ((employeeResult.data ?? []) as { id: string; full_name: string }[]).map(
      (row) => [row.id, row.full_name]
    )
  );

  return ((profileResult.data ?? []) as ProfileRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: roleByUser.get(row.id) ?? null,
    accountStatus: row.account_status,
    employeeId: row.employee_id,
    employeeName: row.employee_id
      ? nameByEmployee.get(row.employee_id) ?? null
      : null,
    lastSignInAt: row.last_sign_in_at,
    createdAt: row.created_at,
  }));
}

export async function listRoleOptions(): Promise<RoleOption[]> {
  const { data, error } = await getServiceSupabase()
    .from("roles")
    .select("name, description")
    .order("name");

  if (error) throw new UserDataError("Gagal memuat daftar role", 500);

  return ((data ?? []) as { name: Role; description: string | null }[]).filter(
    (row) => MANAGEABLE_ROLES.includes(row.name)
  );
}

export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data, error } = await getServiceSupabase()
    .from("employees")
    .select("id, full_name, position")
    .order("full_name");

  if (error) throw new UserDataError("Gagal memuat daftar karyawan", 500);

  return ((data ?? []) as { id: string; full_name: string; position: string }[]).map(
    (row) => ({ id: row.id, fullName: row.full_name, position: row.position })
  );
}

const roleId = async (role: Role): Promise<string> => {
  const { data, error } = await getServiceSupabase()
    .from("roles")
    .select("id")
    .eq("name", role)
    .maybeSingle();

  if (error || !data) throw new UserDataError("Role tidak valid", 400);
  return (data as { id: string }).id;
};

/** Membuat akun internal dengan undangan email (bukan pendaftaran publik). */
export async function createUser(
  input: NewUserInput,
  actorId: string,
  origin: string
): Promise<{ id: string }> {
  const supabase = getServiceSupabase();
  const email = input.email.trim().toLowerCase();
  const role = await roleId(input.role);

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: input.fullName.trim() },
    redirectTo: `${baseUrl(origin)}/auth/confirm?next=/reset-password`,
  });

  if (error) throw new UserDataError(mapAuthError(error.message), 400);

  const userId = data.user?.id;
  if (!userId) throw new UserDataError("Gagal membuat akun pengguna", 500);

  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: userId,
    employee_id: input.employeeId ?? null,
    full_name: input.fullName.trim(),
    email,
    account_status: "Diundang",
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new UserDataError("Gagal menyimpan profil pengguna", 500);
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: userId,
    role_id: role,
    created_by: actorId,
  });

  if (roleError) {
    console.error("[users] gagal menetapkan role", roleError);
    throw new UserDataError("Akun dibuat tetapi role gagal ditetapkan", 500);
  }

  return { id: userId };
}

const currentRoleOf = async (userId: string): Promise<Role | null> => {
  const { data } = await getServiceSupabase()
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .maybeSingle();

  const name = (data as { roles: { name: string } | null } | null)?.roles?.name;
  return name && MANAGEABLE_ROLES.includes(name as Role) ? (name as Role) : null;
};

export async function updateUser(
  userId: string,
  patch: UserUpdateInput,
  actorId: string
): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: profileData, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, account_status, employee_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new UserDataError("Gagal memuat pengguna", 500);
  if (!profileData) throw new UserDataError("Pengguna tidak ditemukan", 404);

  const profile = profileData as ProfileRow;
  const existingRole = await currentRoleOf(userId);

  // Pengguna tidak boleh mengubah role/status akunnya sendiri.
  if (actorId === userId) {
    if (patch.role !== undefined && patch.role !== existingRole) {
      throw new UserDataError("Anda tidak dapat mengubah role sendiri", 403);
    }
    if (
      patch.accountStatus !== undefined &&
      patch.accountStatus !== profile.account_status
    ) {
      throw new UserDataError("Anda tidak dapat mengubah status akun sendiri", 403);
    }
  }

  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName.trim();
  if (patch.employeeId !== undefined) update.employee_id = patch.employeeId;
  if (patch.accountStatus !== undefined) {
    update.account_status = patch.accountStatus;
  }

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update(update)
      .eq("id", userId);
    if (updateError) throw new UserDataError("Gagal memperbarui pengguna", 500);
  }

  if (patch.role !== undefined && patch.role !== existingRole) {
    const newRoleId = await roleId(patch.role);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role_id: newRoleId,
      created_by: actorId,
    });
    if (roleError) throw new UserDataError("Gagal memperbarui role", 500);
  }

  // Nonaktifkan akses login secara terkontrol (akun auth tidak dihapus).
  if (patch.accountStatus !== undefined && patch.accountStatus !== profile.account_status) {
    const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: patch.accountStatus === "Aktif" ? "none" : "876000h",
    });
    if (banError) {
      throw new UserDataError("Status tersimpan tetapi sesi login gagal diperbarui", 500);
    }
  }
}

export async function resendInvite(userId: string, origin: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("email, account_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new UserDataError("Gagal memuat pengguna", 500);
  if (!data) throw new UserDataError("Pengguna tidak ditemukan", 404);

  const profile = data as { email: string; account_status: AccountStatus };

  if (profile.account_status === "Aktif") {
    throw new UserDataError(
      "Akun sudah aktif. Gunakan Reset Password untuk mengirim tautan baru.",
      409
    );
  }

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    profile.email,
    {
      redirectTo: `${baseUrl(origin)}/auth/confirm?next=/reset-password`,
    }
  );

  if (inviteError) throw new UserDataError(mapAuthError(inviteError.message), 400);
}

export async function sendPasswordReset(
  userId: string,
  origin: string
): Promise<void> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new UserDataError("Gagal memuat pengguna", 500);
  if (!data) throw new UserDataError("Pengguna tidak ditemukan", 404);

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    (data as { email: string }).email,
    { redirectTo: `${baseUrl(origin)}/auth/confirm?next=/reset-password` }
  );

  if (resetError) {
    throw new UserDataError(
      "Gagal mengirim tautan reset password. Periksa konfigurasi email.",
      400
    );
  }
}

export async function getUserHistory(userId: string): Promise<UserAccessEntry[]> {
  const { data, error } = await getServiceSupabase()
    .from("user_access_history")
    .select("id, action, from_value, to_value, reason, changed_at")
    .eq("user_id", userId)
    .order("changed_at", { ascending: false })
    .limit(50);

  if (error) throw new UserDataError("Gagal memuat riwayat pengguna", 500);

  return (
    (data ?? []) as {
      id: number;
      action: string;
      from_value: string | null;
      to_value: string | null;
      reason: string | null;
      changed_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    action: row.action,
    fromValue: row.from_value,
    toValue: row.to_value,
    reason: row.reason,
    changedAt: row.changed_at,
  }));
}
