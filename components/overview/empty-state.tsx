import type { ReactNode } from "react";

/** Placeholder seragam untuk bagian yang belum punya data. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[12px] sub text-center py-6 border border-dashed rounded-xl mx-6 mb-5"
      style={{ borderColor: "#DDD5D1" }}
    >
      {children}
    </div>
  );
}
