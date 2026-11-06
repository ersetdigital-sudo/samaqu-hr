import Link from "next/link";

export default function LowonganNotFound() {
  return <div className="rl"><div className="rl-card rl-empty"><h1>Lowongan tidak ditemukan</h1><p>Lowongan ini tidak tersedia atau sudah dihapus.</p><Link href="/recruitment/lowongan" className="rl-btn rl-primary">Kembali ke daftar lowongan</Link></div></div>;
}
