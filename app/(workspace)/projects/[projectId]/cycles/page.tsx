import { ProjectCycles } from "@/components/projects/project-cycles";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectCycles projectId={projectId} />;
}
