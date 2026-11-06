import { ACCOUNT_STATUSES, MANAGEABLE_ROLES, type NewUserInput } from "@/lib/users/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Record<string, string>;

export function validateNewUser(input: Partial<NewUserInput>): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.fullName || input.fullName.trim().length < 2) {
    errors.fullName = "Nama lengkap wajib diisi";
  }
  if (!input.email || !EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Format email tidak valid";
  }
  if (!input.role || !MANAGEABLE_ROLES.includes(input.role)) {
    errors.role = "Role tidak valid";
  }

  return errors;
}

export function validateUserUpdate(body: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {};

  if (body.fullName !== undefined) {
    if (typeof body.fullName !== "string" || body.fullName.trim().length < 2) {
      errors.fullName = "Nama lengkap wajib diisi";
    }
  }
  if (body.role !== undefined && !MANAGEABLE_ROLES.includes(body.role as never)) {
    errors.role = "Role tidak valid";
  }
  if (
    body.accountStatus !== undefined &&
    !ACCOUNT_STATUSES.includes(body.accountStatus as never)
  ) {
    errors.accountStatus = "Status akun tidak valid";
  }

  return errors;
}
