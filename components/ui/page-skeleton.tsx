/** Skeleton ringan untuk halaman data; tidak menahan konten lain. */
export function PageSkeleton({
  rows = 6,
  cards = 4,
}: {
  rows?: number;
  cards?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat data…</span>

      <div className="h-8 w-56 rounded bg-[#F1EDEB] animate-pulse mb-2" />
      <div className="h-4 w-80 max-w-full rounded bg-[#F6F2F0] animate-pulse mb-6" />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: cards }).map((_, index) => (
          <div className="card p-5" key={index}>
            <div className="h-3 w-20 rounded bg-[#F1EDEB] animate-pulse" />
            <div className="h-7 w-14 rounded bg-[#F6F2F0] animate-pulse mt-3" />
            <div className="h-3 w-24 rounded bg-[#F6F2F0] animate-pulse mt-2" />
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div
          className="h-11 border-b"
          style={{ borderColor: "var(--line)" }}
        />
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 px-5 py-4 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="h-8 w-8 rounded-full bg-[#F1EDEB] animate-pulse" />
            <div className="h-3.5 flex-1 rounded bg-[#F6F2F0] animate-pulse" />
            <div className="h-3.5 w-24 rounded bg-[#F6F2F0] animate-pulse" />
            <div className="h-3.5 w-16 rounded bg-[#F6F2F0] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
