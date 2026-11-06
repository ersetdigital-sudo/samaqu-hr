import { stageTone } from "@/lib/data";

export function StageTag({ stage }: { stage: string }) {
  return <span className={`tag ${stageTone(stage)}`}>{stage}</span>;
}
