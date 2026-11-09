import { parseIsoDate } from "./format";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  LOCATIONS,
  type EmployeeInput,
  type EmploymentType,
} from "./types";
import { isValidEmail } from "./validation";
import type { ApplicationEmployeeSource } from "@/lib/recruitment/live/types";

const nonEmpty = (value: string) => value.trim();

/**
 * Hanya memetakan nilai lamaran yang sah terhadap pilihan form karyawan.
 * Field di luar itu sengaja dibiarkan untuk diisi HR.
 */
export function buildEmployeePrefill(
  source: ApplicationEmployeeSource,
): Partial<EmployeeInput> {
  const prefill: Partial<EmployeeInput> = {};

  if (nonEmpty(source.fullName)) prefill.fullName = nonEmpty(source.fullName);
  if (nonEmpty(source.position)) prefill.position = nonEmpty(source.position);
  if (nonEmpty(source.phone)) prefill.phone = nonEmpty(source.phone);
  if (isValidEmail(source.email.trim()))
    prefill.personalEmail = source.email.trim().toLowerCase();
  if (parseIsoDate(source.birthDate)) prefill.birthDate = source.birthDate;

  const department = source.department.trim();
  if ((DEPARTMENTS as readonly string[]).includes(department))
    prefill.department = department;

  const location = source.location.trim();
  if ((LOCATIONS as readonly string[]).includes(location))
    prefill.location = location;

  const employmentType = source.employmentType.trim();
  if ((EMPLOYMENT_TYPES as readonly string[]).includes(employmentType))
    prefill.employmentType = employmentType as EmploymentType;

  return prefill;
}
