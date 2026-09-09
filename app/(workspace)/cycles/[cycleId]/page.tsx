import { CycleDetail } from "@/components/cycles/cycle-detail";

export default async function Page({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  return <CycleDetail cycleId={cycleId} />;
}
