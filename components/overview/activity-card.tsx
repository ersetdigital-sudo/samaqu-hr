import { EmptyState } from "@/components/overview/empty-state";
import { ini } from "@/lib/data";
import type { Activity } from "@/lib/recruitment/types";

/** Aktivitas rekrutmen terbaru, diurutkan berdasarkan waktu kejadian. */
export function ActivityCard({ activities }: { activities: Activity[] }) {
  return (
    <div className="card lg:col-span-3 min-w-0">
      <div className="px-6 pt-5 pb-3 font-bold text-[16px]">
        Aktivitas Terbaru
      </div>
      {activities.length === 0 ? (
        <EmptyState>Belum ada aktivitas rekrutmen.</EmptyState>
      ) : (
        activities.map((activity) => (
          <div
            className="flex gap-3 px-6 py-3 border-t"
            key={activity.id}
            style={{ borderColor: "var(--line)" }}
          >
            <div className="av" style={{ width: 30, height: 30, fontSize: 11 }}>
              {ini(activity.actor)}
            </div>
            <div className="flex-1 text-[13px]">
              <b>{activity.actor}</b>
              {activity.before}
              <b>{activity.subject}</b>
              {activity.after}
            </div>
            <div className="text-[12px] sub whitespace-nowrap">
              {activity.label}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
