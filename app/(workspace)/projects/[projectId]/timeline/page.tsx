import { TimelinePage } from "@/components/gantt/timeline-page";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <TimelinePage projectId={projectId} />;
}
