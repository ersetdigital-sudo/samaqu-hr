import Link from "next/link";

export function SummaryCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className="card p-5 transition hover:-translate-y-0.5"
    >
      <div className="text-[12px] sub font-semibold">{label}</div>
      <div className="text-[26px] font-bold tracking-tight mt-2">{value}</div>
      <div className="text-[12px] sub mt-1">{hint}</div>
    </Link>
  );
}
