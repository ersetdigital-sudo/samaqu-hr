import type { ReactNode } from "react";

export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="h1">{title}</div>
        <div className="sub mt-1">{subtitle}</div>
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
