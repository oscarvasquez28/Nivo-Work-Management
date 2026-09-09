import { ProjectLayout } from "@/components/projects/project-layout";

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectLayout projectId={projectId}>{children}</ProjectLayout>;
}
