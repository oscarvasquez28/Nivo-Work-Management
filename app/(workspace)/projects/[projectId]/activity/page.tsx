import { ProjectActivity } from "@/components/projects/project-activity";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectActivity projectId={projectId} />;
}
