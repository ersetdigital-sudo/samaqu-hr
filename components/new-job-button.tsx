"use client";

import { Icon } from "@/components/icons";
import { useRecruitment } from "@/components/recruitment-provider";

export function NewJobButton() {
  const { openJobModal } = useRecruitment();

  return (
    <button className="btn btn-p" onClick={openJobModal}>
      <Icon name="plus" style={{ width: 16 }} />
      Buat Lowongan
    </button>
  );
}
