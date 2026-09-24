"use client";

import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/stores/workspace";
import { IssueExplorer } from "@/components/issues/issue-explorer";

export function MyIssues() {
  const { data } = useWorkspace();
  const { t } = useI18n();
  if (!data) return null;
  return <IssueExplorer title={t("nav.myIssues")} assigneeId={data.currentUserId} />;
}
