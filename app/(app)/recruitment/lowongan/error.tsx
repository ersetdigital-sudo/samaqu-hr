"use client";

import { ErrorBox } from "@/components/recruitment-live/ui";

export default function LowonganError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="rl"><h1>Lowongan belum dapat dimuat</h1><ErrorBox message="Terjadi kendala saat mengambil data. Coba lagi untuk melanjutkan." retry={reset} /></div>;
}
