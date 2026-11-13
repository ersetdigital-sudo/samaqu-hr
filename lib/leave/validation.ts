/** Aturan lampiran cuti: pola dan batas sama dengan Dokumen & Berkas. */

import {
  DOCUMENT_ACCEPT,
  DOCUMENT_SIZE_ERROR,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_SIZE_LABEL,
  extensionForMime,
  sanitizeFileName,
  validateDocumentFileBytes,
  validateDocumentFileMeta,
} from "@/lib/documents/validation";
import type { LeaveAttachmentMime } from "@/lib/leave/types";

export const LEAVE_ATTACHMENT_BUCKET = "leave-attachments";
export const LEAVE_ATTACHMENT_ACCEPT = DOCUMENT_ACCEPT;
export const LEAVE_ATTACHMENT_MAX_BYTES = MAX_DOCUMENT_BYTES;
export const LEAVE_ATTACHMENT_SIZE_LABEL = MAX_DOCUMENT_SIZE_LABEL;
export const LEAVE_ATTACHMENT_SIZE_ERROR = DOCUMENT_SIZE_ERROR;

export type { LeaveAttachmentMime };

export function validateLeaveAttachmentMeta(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  return validateDocumentFileMeta(file);
}

export function validateLeaveAttachmentBytes(
  bytes: Uint8Array,
  fileName: string,
  declaredType: string
): { ok: true; mimeType: LeaveAttachmentMime } | { ok: false; error: string } {
  return validateDocumentFileBytes(bytes, fileName, declaredType);
}

export const leaveAttachmentExtension = extensionForMime;
export const sanitizeLeaveAttachmentName = sanitizeFileName;
