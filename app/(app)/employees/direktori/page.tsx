import { DirectoryView } from "@/components/employees/directory-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { buildEmployeePrefill } from "@/lib/employees/conversion";
import {
  findEmployeeByNameAndBirthDate,
  getNextEmployeeId,
  listEmployeeSummaries,
} from "@/lib/employees/repository";
import { getApplicationEmployeeSource } from "@/lib/recruitment/live/repository";

export const dynamic = "force-dynamic";

export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    convert?: string;
    employee?: string;
    converted?: string;
  }>;
}) {
  await requireRole(["hr_manager"]);

  const params = await searchParams;
  const convertId = typeof params.convert === "string" ? params.convert : null;
  const employeeId =
    typeof params.employee === "string" ? params.employee : null;
  const converted = params.converted === "1";

  const loadDirectory = Promise.all([
    listEmployeeSummaries(),
    getNextEmployeeId(),
  ]);
  const loadConversion = (async () => {
    if (!convertId) return { conversion: null, conversionError: null };

    try {
      const source = await getApplicationEmployeeSource(convertId);
      let warning: string | null = null;
      try {
        const duplicate = await findEmployeeByNameAndBirthDate(
          source.fullName,
          source.birthDate
        );
        if (duplicate)
          warning = `Sudah ada karyawan dengan nama dan tanggal lahir yang sama (${duplicate.id} · ${duplicate.fullName}). Pastikan bukan orang yang sama.`;
      } catch {
        // Peringatan lembut bersifat opsional; kegagalan cek tidak memblokir form.
      }
      return {
        conversion: {
          applicationId: source.applicationId,
          prefill: buildEmployeePrefill(source),
          warning,
        },
        conversionError: null,
      };
    } catch (error) {
      return {
        conversion: null,
        conversionError:
          error instanceof Error
            ? error.message
            : "Data lamaran tidak dapat dimuat untuk konversi.",
      };
    }
  })();

  const [[employees, nextId], conversionState] = await Promise.all([
    loadDirectory,
    loadConversion,
  ]);
  const { conversion, conversionError } = conversionState;

  return (
    <DirectoryView
      key={`${conversion?.applicationId ?? "none"}:${employeeId ?? "none"}:${converted ? "1" : "0"}`}
      initialEmployees={employees}
      initialNextId={nextId}
      initialEmployeeId={employeeId}
      converted={converted}
      conversion={conversion}
      conversionError={conversionError}
      todayIso={isoDateJakarta()}
    />
  );
}
