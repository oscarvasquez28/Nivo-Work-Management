"use client";

import { useWorkspace } from "@/stores/workspace";
import { IssueExplorer } from "@/components/issues/issue-explorer";

export function MyIssues() {
  const { data } = useWorkspace();
  if (!data) return null;
  return <IssueExplorer title="My issues" assigneeId={data.currentUserId} />;
}
