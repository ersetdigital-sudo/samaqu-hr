import { notFound } from "next/navigation";
import { SubpageView } from "@/components/views/subpage-view";
import { findModule } from "@/lib/navigation";

/**
 * Halaman submenu Knowledge Hub yang mengikuti konfigurasi navigasi.
 * Beranda punya route statis sendiri (`/knowledge-hub/beranda`).
 */
export default async function KnowledgeHubSubPage({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const module = findModule("knowledge-hub");

  if (!module?.items.some((item) => item.id === sub)) {
    notFound();
  }

  return <SubpageView moduleId="knowledge-hub" subId={sub} />;
}
