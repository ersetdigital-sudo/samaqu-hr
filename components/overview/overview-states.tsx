"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Skeleton saat data rekrutmen sedang dimuat ulang. */
export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data rekrutmen…</span>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="card p-5" key={index}>
            <div className="h-3.5 w-24 rounded bg-[#F1EDEB] animate-pulse" />
            <div className="h-8 w-16 rounded bg-[#F6F2F0] animate-pulse mt-3" />
            <div className="h-3 w-20 rounded bg-[#F6F2F0] animate-pulse mt-2" />
          </div>
        ))}
      </div>

      <div className="card p-6 mb-6">
        <div className="h-5 w-40 rounded bg-[#F1EDEB] animate-pulse" />
        <div className="h-3 w-64 rounded bg-[#F6F2F0] animate-pulse mt-2 mb-5" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index}>
              <div className="h-3 w-full rounded bg-[#F6F2F0] animate-pulse mb-2" />
              <div className="h-24 rounded-xl bg-[#F6F2F0] animate-pulse" />
              <div className="h-5 w-10 rounded bg-[#F1EDEB] animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card lg:col-span-3 p-6">
          <div className="h-5 w-36 rounded bg-[#F1EDEB] animate-pulse mb-5" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="flex gap-3 py-3" key={index}>
              <div className="w-[30px] h-[30px] rounded-full bg-[#F1EDEB] animate-pulse" />
              <div className="flex-1 h-4 rounded bg-[#F6F2F0] animate-pulse" />
              <div className="h-4 w-16 rounded bg-[#F6F2F0] animate-pulse" />
            </div>
          ))}
        </div>
        <div className="card lg:col-span-2 p-6">
          <div className="h-5 w-40 rounded bg-[#F1EDEB] animate-pulse mb-5" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="flex gap-4 py-3" key={index}>
              <div className="w-12 h-10 rounded bg-[#F1EDEB] animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-[#F6F2F0] animate-pulse" />
                <div className="h-3 w-44 rounded bg-[#F6F2F0] animate-pulse mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Error state dengan tombol muat ulang dari server. */
export function OverviewErrorState({ message }: { message?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="card p-8 text-center">
      <div className="font-bold text-[16px]">Data rekrutmen gagal dimuat</div>
      <div className="sub text-[13px] mt-1">
        {message ?? "Terjadi kesalahan yang tidak diketahui."}
      </div>
      <button
        className="btn btn-p mt-4"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
      >
        {pending ? "Memuat…" : "Coba lagi"}
      </button>
    </div>
  );
}
