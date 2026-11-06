import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./careers.module.css";

const paths: Record<string, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  check: <path d="M5 12l5 5 9-10" />,
  job: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
};

export function CareerIcon({
  name,
  size = 16,
  strokeWidth = 2,
}: {
  name: keyof typeof paths;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {paths[name]}
    </svg>
  );
}

export function CareerHeader({ otherJobs = false }: { otherJobs?: boolean }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>S</div>
        <div className={styles.brandText}>
          <strong>SAMAQU</strong>
          <span>Karir</span>
        </div>
      </div>
      {otherJobs && (
        <Link prefetch={false} href="/karir" className={styles.otherJobs}>
          Lowongan lain
        </Link>
      )}
    </header>
  );
}

export function formatClosingDate(value: string | null) {
  if (!value) return "Tanpa batas waktu";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

export function JobInfo({
  employment_type,
  location,
  closes_at,
}: {
  employment_type: string;
  location: string;
  closes_at: string | null;
}) {
  return (
    <div className={styles.infoChips}>
      <span>
        <CareerIcon name="job" size={14} />
        {employment_type}
      </span>
      <span>
        <CareerIcon name="location" size={14} />
        {location}
      </span>
      <span>
        <CareerIcon name="clock" size={14} />
        {closes_at
          ? `Tutup ${formatClosingDate(closes_at)}`
          : "Tanpa batas waktu"}
      </span>
    </div>
  );
}
