import type { CSSProperties } from "react";
import type { StatCard } from "@/lib/recruitment/types";

/** Kartu statistik atas; seluruh nilai berasal dari selectors, bukan hardcode. */
export function StatCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`card p-5 ${stat.highlight ? "ring-1" : ""}`}
          style={
            stat.highlight
              ? ({
                  "--tw-ring-color": "var(--pink-100)",
                } as CSSProperties)
              : undefined
          }
        >
          <div className="text-[13px] sub font-medium">{stat.label}</div>
          <div
            className="text-[30px] font-bold tracking-tight mt-2"
            style={stat.highlight ? { color: "var(--pink)" } : undefined}
          >
            {stat.value}
          </div>
          <div className="text-[12px] sub mt-1">{stat.hint}</div>
        </div>
      ))}
    </div>
  );
}
