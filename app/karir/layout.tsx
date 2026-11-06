import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "SAMAQU · Karir", description: "Temukan lowongan kerja dan bergabung bersama tim SAMAQU." };

export default function CareersLayout({ children }: { children: ReactNode }) {
  return children;
}
