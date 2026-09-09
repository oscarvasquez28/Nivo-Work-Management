import { IssueDetail } from "@/components/issues/issue-detail";

export default async function Page({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <IssueDetail issueId={issueId} />;
}
