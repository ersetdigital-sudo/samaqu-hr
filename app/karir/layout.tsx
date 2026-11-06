import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SAMAQU · Karir",
  description: "Temukan lowongan kerja dan bergabung bersama tim SAMAQU.",
};

/** Public job pages are refreshed on publish/close or after one hour. */
export const revalidate = 3600;

export default function CareersLayout({ children }: { children: ReactNode }) {
  return children;
}
