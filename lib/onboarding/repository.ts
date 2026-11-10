import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  RecruitmentError,
  assertId,
} from "@/lib/recruitment/live/http";
import type { EmployeeStatus } from "@/lib/employees/types";
import type {
  OnboardingBoard,
  OnboardingEmployeeOption,
  OnboardingEntry,
  OnboardingItem,
  OnboardingItemPatch,
} from "./types";

const ITEM_COLUMNS =
  "id,onboarding_id,label,done,completed_on,notes,sort_order";
const EMPLOYEE_COLUMNS =
  "id,full_name,position,department,status,joined_at";
const EMPLOYEE_LIMIT = 300;

type RawEntry = {
  id: string;
  employee_id: string;
  created_at: string;
  employee:
    | {
        id: string;
        full_name: string;
        position: string;
        department: string;
        status: EmployeeStatus;
        joined_at: string;
      }
    | {
        id: string;
        full_name: string;
        position: string;
        department: string;
        status: EmployeeStatus;
        joined_at: string;
      }[]
    | null;
};

type RawItem = {
  id: string;
  onboarding_id: string;
  label: string;
  done: boolean;
  completed_on: string | null;
  notes: string;
  sort_order: number;
};

const mapItem = (row: RawItem): OnboardingItem => ({
  id: row.id,
  onboardingId: row.onboarding_id,
  label: row.label,
  done: row.done,
  completedOn: row.completed_on,
  notes: row.notes,
  sortOrder: row.sort_order,
});

const fail = (
  error: { code?: string; message?: string },
  action: string,
): never => {
  if (error.code === "42501")
    throw new RecruitmentError("Akses ditolak", 403);
  if (error.code === "23505")
    throw new RecruitmentError(
      "Karyawan ini sudah punya onboarding. Muat ulang lalu cek daftarnya.",
      409,
    );
  if (error.code === "P0002")
    throw new RecruitmentError("Karyawan tidak ditemukan", 404);
  if (error.code === "23503")
    throw new RecruitmentError("Onboarding tidak ditemukan", 404);
  if (error.code === "23514" || error.code === "P0001") {
    const message = error.message?.replace(/^.*?:\s*/, "") ?? "";
    throw new RecruitmentError(
      message || "Data onboarding tidak valid. Periksa kembali isian.",
      400,
    );
  }
  throw new RecruitmentError(`Gagal ${action} data onboarding`, 500);
};

const entryFromRow = (
  row: RawEntry,
  items: OnboardingItem[],
): OnboardingEntry | null => {
  const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee;
  if (!employee) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: employee.full_name,
    position: employee.position,
    department: employee.department,
    employeeStatus: employee.status,
    joinedAt: employee.joined_at,
    createdAt: row.created_at,
    items,
  };
};

/** Satu snapshot: onboarding + item + karyawan yang belum punya onboarding. */
export async function getOnboardingBoard(): Promise<OnboardingBoard> {
  const db = await getServerSupabase();
  const [entriesResult, employeesResult] = await Promise.all([
    db
      .from("employee_onboardings")
      .select(`id,employee_id,created_at,employee:employees(${EMPLOYEE_COLUMNS})`)
      .order("created_at", { ascending: false }),
    db
      .from("employees")
      .select("id,full_name,position,status,joined_at")
      .in("status", ["Aktif", "Probation"])
      .order("joined_at", { ascending: false })
      .limit(EMPLOYEE_LIMIT),
  ]);

  if (entriesResult.error) fail(entriesResult.error, "memuat");
  if (employeesResult.error) fail(employeesResult.error, "memuat");

  const rows = (entriesResult.data ?? []) as unknown as RawEntry[];
  const ids = rows.map((row) => row.id);

  let items: RawItem[] = [];
  if (ids.length > 0) {
    const itemsResult = await db
      .from("employee_onboarding_items")
      .select(ITEM_COLUMNS)
      .in("onboarding_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (itemsResult.error) fail(itemsResult.error, "memuat");
    items = (itemsResult.data ?? []) as unknown as RawItem[];
  }

  const itemsByOnboarding = new Map<string, OnboardingItem[]>();
  for (const item of items) {
    const list = itemsByOnboarding.get(item.onboarding_id) ?? [];
    list.push(mapItem(item));
    itemsByOnboarding.set(item.onboarding_id, list);
  }

  const entries: OnboardingEntry[] = rows.flatMap((row) => {
    const entry = entryFromRow(row, itemsByOnboarding.get(row.id) ?? []);
    return entry ? [entry] : [];
  });

  const onboarded = new Set(entries.map((entry) => entry.employeeId));
  const available: OnboardingEmployeeOption[] = (
    (employeesResult.data ?? []) as {
      id: string;
      full_name: string;
      position: string;
      status: EmployeeStatus;
      joined_at: string;
    }[]
  )
    .filter((employee) => !onboarded.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      fullName: employee.full_name,
      position: employee.position,
      status: employee.status,
      joinedAt: employee.joined_at,
    }));

  return { entries, available };
}

async function getOnboardingEntry(
  id: string,
): Promise<OnboardingEntry | null> {
  const db = await getServerSupabase();
  const { data, error } = await db
    .from("employee_onboardings")
    .select(`id,employee_id,created_at,employee:employees(${EMPLOYEE_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error, "memuat");
  if (!data) return null;

  const itemsResult = await db
    .from("employee_onboarding_items")
    .select(ITEM_COLUMNS)
    .eq("onboarding_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemsResult.error) fail(itemsResult.error, "memuat");

  return entryFromRow(
    data as unknown as RawEntry,
    ((itemsResult.data ?? []) as unknown as RawItem[]).map(mapItem),
  );
}

export async function startOnboarding(
  employeeId: string,
): Promise<OnboardingEntry> {
  const trimmed = employeeId.trim();
  if (!/^SQ-EMP-[0-9]{4,}$/.test(trimmed))
    throw new RecruitmentError("Karyawan tidak ditemukan", 404);

  const { data, error } = await (await getServerSupabase()).rpc(
    "start_employee_onboarding",
    { p_employee_id: trimmed },
  );
  if (error) fail(error, "memulai");

  const entry = await getOnboardingEntry((data as string) ?? "");
  if (!entry)
    throw new RecruitmentError(
      "Onboarding tersimpan tetapi gagal dibaca kembali",
      500,
    );
  return entry;
}

export async function updateOnboardingItem(
  itemId: string,
  patch: OnboardingItemPatch,
): Promise<OnboardingItem> {
  assertId(itemId);
  const update: Record<string, unknown> = {};

  if (patch.done !== undefined) {
    if (typeof patch.done !== "boolean")
      throw new RecruitmentError("Status item tidak valid", 400);
    update.done = patch.done;
  }

  if (patch.completedOn !== undefined) {
    if (
      patch.completedOn !== null &&
      !/^\d{4}-\d{2}-\d{2}$/.test(patch.completedOn)
    )
      throw new RecruitmentError("Tanggal selesai tidak valid", 400);
    update.completed_on = patch.completedOn;
  }

  if (patch.notes !== undefined) {
    if (typeof patch.notes !== "string" || patch.notes.length > 500)
      throw new RecruitmentError("Catatan maksimal 500 karakter", 400);
    update.notes = patch.notes.trim();
  }

  if (Object.keys(update).length === 0)
    throw new RecruitmentError("Tidak ada perubahan yang valid", 400);

  const { data, error } = await (await getServerSupabase())
    .from("employee_onboarding_items")
    .update(update)
    .eq("id", itemId)
    .select(ITEM_COLUMNS)
    .maybeSingle();

  if (error) fail(error, "memperbarui");
  if (!data)
    throw new RecruitmentError("Item onboarding tidak ditemukan", 404);
  return mapItem(data as unknown as RawItem);
}

export async function addOnboardingItem(
  onboardingId: string,
  label: string,
): Promise<OnboardingItem> {
  assertId(onboardingId);
  const trimmed = label.trim();
  if (!trimmed)
    throw new RecruitmentError("Nama item wajib diisi", 400);
  if (trimmed.length > 200)
    throw new RecruitmentError("Nama item maksimal 200 karakter", 400);

  const db = await getServerSupabase();
  const { data: last, error: lastError } = await db
    .from("employee_onboarding_items")
    .select("sort_order")
    .eq("onboarding_id", onboardingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) fail(lastError, "memuat");

  const { data, error } = await db
    .from("employee_onboarding_items")
    .insert({
      onboarding_id: onboardingId,
      label: trimmed,
      sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1,
    })
    .select(ITEM_COLUMNS)
    .single();

  if (error) fail(error, "menambah");
  return mapItem(data as unknown as RawItem);
}

export async function deleteOnboardingItem(itemId: string): Promise<void> {
  assertId(itemId);
  const { data, error } = await (await getServerSupabase())
    .from("employee_onboarding_items")
    .delete()
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (error) fail(error, "menghapus");
  if (!data)
    throw new RecruitmentError("Item onboarding tidak ditemukan", 404);
}
