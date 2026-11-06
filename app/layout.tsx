import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { plusJakartaSans } from "./fonts";

export const metadata: Metadata = {
  title: "SAMAQU · HRIS",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
