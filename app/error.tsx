"use client";

import { useEffect } from "react";

/** Error boundary untuk kegagalan render/permintaan data pada level route. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[recruitment] error halaman", error);
  }, [error]);

  return (
    <div className="card p-8 text-center">
      <div className="font-bold text-[16px]">Data rekrutmen gagal dimuat</div>
      <div className="sub text-[13px] mt-1">
        {error.message || "Terjadi kesalahan yang tidak diketahui."}
      </div>
      <button className="btn btn-p mt-4" onClick={reset}>
        Coba lagi
      </button>
    </div>
  );
}
