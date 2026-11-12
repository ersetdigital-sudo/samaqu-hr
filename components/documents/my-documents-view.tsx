import { PageHead } from "@/components/page-head";
import { formatDateID } from "@/lib/datetime";
import { formatFileSize } from "@/lib/documents/query";
import {
  documentExpiryStatus,
  documentStatusTone,
} from "@/lib/documents/status";
import type { EmployeeDocument } from "@/lib/documents/types";

export function MyDocumentsView({
  linked,
  documents,
  todayIso,
}: {
  linked: boolean;
  documents: EmployeeDocument[];
  todayIso: string;
}) {
  if (!linked) {
    return (
      <>
        <PageHead
          title="Dokumen Saya"
          subtitle="Dokumen pribadi yang diunggah HR untuk kamu."
        />
        <div className="card p-6 max-w-[640px]">
          <div className="font-bold text-[15px]">Akun belum tertaut</div>
          <div className="sub text-[13px] mt-2">
            Akun kamu belum tertaut ke data karyawan, sehingga dokumen pribadi
            belum bisa ditampilkan. Hubungi admin HR untuk menautkan akunmu.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Dokumen Saya"
        subtitle="Dokumen pribadi yang diunggah HR. Kamu hanya bisa melihat dan mengunduh."
      />

      <div className="card p-4 mb-5 text-[12px] sub">
        Untuk mengganti atau menambah dokumen, hubungi HR Manager. Data di
        halaman ini hanya bisa dibaca.
      </div>

      <div className="grid gap-3">
        {documents.map((document) => {
          const status = documentExpiryStatus(document.validUntil, todayIso);
          return (
            <div
              key={document.id}
              className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tag t-mute">{document.docType}</span>
                  {status && (
                    <span className={`tag ${documentStatusTone(status)}`}>
                      {status}
                    </span>
                  )}
                </div>
                <div className="font-semibold text-[14px] mt-1 break-words">
                  {document.title ?? document.fileName}
                </div>
                <div className="text-[12px] sub break-words">
                  {document.fileName} · {formatFileSize(document.fileSize)}
                </div>
                <div className="text-[11px] sub mt-1">
                  Berlaku s/d {formatDateID(document.validUntil)} · Diunggah{" "}
                  {formatDateID(document.uploadedAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <a
                  className="btn btn-g"
                  href={`/api/documents/${document.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Lihat
                </a>
                <a
                  className="btn btn-p"
                  href={`/api/documents/${document.id}/file?download=1`}
                >
                  Unduh
                </a>
              </div>
            </div>
          );
        })}
        {documents.length === 0 && (
          <div className="card p-8 text-center">
            <div className="font-semibold text-[14px]">Belum ada dokumen</div>
            <div className="sub text-[13px] mt-1">
              Dokumen yang diunggah HR akan muncul di sini.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
