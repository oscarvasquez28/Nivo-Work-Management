import { ProjectOverview } from "@/components/projects/project-overview";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectOverview projectId={projectId} />;
}
