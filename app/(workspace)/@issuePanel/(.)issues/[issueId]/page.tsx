import { IssueRoutePanel } from "@/components/issue-route-panel";

export default async function Page({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <IssueRoutePanel issueId={issueId} />;
}
