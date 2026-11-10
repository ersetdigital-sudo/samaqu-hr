import Link from "next/link";
import { Icon } from "@/components/icons";
import { isModuleLive, type NavModule } from "@/lib/navigation";

export function ModuleCard({ module }: { module: NavModule }) {
  const live = isModuleLive(module);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-9 h-9 rounded-lg grid place-items-center"
          style={{ background: "#F2F0EF" }}
        >
          <Icon name={module.icon} style={{ width: 17 }} />
        </div>
        {module.external ? (
          <span className="tag t-info">
            <Icon name="external" style={{ width: 12 }} />
            Eksternal
          </span>
        ) : (
          <span className={`tag ${live ? "t-ok" : "t-mute"}`}>
            {live ? "Tersedia" : "Segera"}
          </span>
        )}
      </div>
      <div>
        <div className="font-bold text-[14px]">{module.label}</div>
        <div className="text-[12px] sub mt-1 leading-snug">
          {module.description}
        </div>
      </div>
    </>
  );

  return module.external ? (
    <a
      href={module.href}
      target="_blank"
      rel="noopener noreferrer"
      className="card p-5 flex flex-col gap-3 transition hover:-translate-y-0.5"
    >
      {content}
    </a>
  ) : (
    <Link
      prefetch={false}
      href={module.href}
      className="card p-5 flex flex-col gap-3 transition hover:-translate-y-0.5"
    >
      {content}
    </Link>
  );
}
