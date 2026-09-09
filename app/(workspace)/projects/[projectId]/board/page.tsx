import { IssueExplorer } from "@/components/issues/issue-explorer";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <IssueExplorer projectId={projectId} initialLayout="board" title="Board" />;
}
